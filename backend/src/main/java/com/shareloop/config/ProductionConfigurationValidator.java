package com.shareloop.config;

import com.shareloop.security.google.GoogleSecurityProperties;
import com.shareloop.security.ratelimit.ClientIpResolver;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Validates production configuration. Invoked by
 * {@link ProductionProfileEnvironmentPostProcessor} before the application
 * context, Flyway and the web server start, so an invalid production
 * configuration never reaches a migrated database or an accepting listener.
 */
public class ProductionConfigurationValidator {

    private static final Logger log = LoggerFactory.getLogger(ProductionConfigurationValidator.class);
    public static final String DEFAULT_FORGOT_PASSWORD_SECRET = "shareloop-forgot-password-salt-key-default";

    private static final String POSTGRES_JDBC_PREFIX = "jdbc:postgresql://";
    private static final Set<String> SECURE_SSL_MODES = Set.of("require", "verify-ca", "verify-full");

    private final Environment environment;
    private final MailProperties mailProperties;
    private final RateLimitProperties rateLimitProperties;
    private final GoogleSecurityProperties googleSecurityProperties;
    private final CorsProperties corsProperties;
    private final StorageProperties storageProperties;

    public ProductionConfigurationValidator(
            Environment environment,
            MailProperties mailProperties,
            RateLimitProperties rateLimitProperties,
            GoogleSecurityProperties googleSecurityProperties,
            CorsProperties corsProperties,
            StorageProperties storageProperties
    ) {
        this.environment = environment;
        this.mailProperties = mailProperties;
        this.rateLimitProperties = rateLimitProperties;
        this.googleSecurityProperties = googleSecurityProperties;
        this.corsProperties = corsProperties;
        this.storageProperties = storageProperties;
    }

    public void validateConfiguration() {
        boolean isProduction = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!isProduction) {
            if (ProductionProfileEnvironmentPostProcessor.isProductionDeployment(environment)) {
                throw new IllegalStateException(ProductionProfileEnvironmentPostProcessor.MISSING_PROD_PROFILE_MESSAGE);
            }
            return;
        }

        log.info("Validating production configuration rules...");

        validateMail();
        validateForgotPasswordSecret();
        validateFrontendBaseUrl();
        validateGoogleLogin();
        validateCors();
        validateStorage();
        validateDatasource();
        validateFlyway();
        validateForwardingConfiguration();
        validateUploadQuotaCleanupTtl();

        log.info("Production configuration validation passed successfully.");
    }

    /**
     * Prevents Spring from rewriting the request remote address from
     * client-controlled headers, and validates the explicit client IP trust model.
     */
    private void validateForwardingConfiguration() {
        String strategy = environment.getProperty("server.forward-headers-strategy");
        String normalized = strategy == null ? "none" : strategy.trim().toLowerCase(Locale.ROOT);
        if (!normalized.isEmpty() && !"none".equals(normalized)) {
            throw new IllegalStateException(
                    "Production must set server.forward-headers-strategy=none so forwarded headers cannot " +
                            "rewrite the request remote address. Client IPs are resolved explicitly through " +
                            "CLIENT_IP_MODE and the configured trusted proxy boundary."
            );
        }

        ClientIpResolver.validateConfiguration(rateLimitProperties);

        RateLimitProperties.ClientIpMode mode = rateLimitProperties.getClientIpMode();
        if (mode == RateLimitProperties.ClientIpMode.TRUSTED_CIDR) {
            log.info("Client IP trust model: {}", mode);
        } else {
            log.info("Client IP trust model: DIRECT (forwarding headers ignored)");
        }
    }

    /**
     * Quota usage is derived from uploaded_files rows; a row is removed only after
     * physical deletion. If cleanup could delete rows before the rolling quota
     * window expires, deleted bytes would re-fund the quota early. Production
     * therefore requires cleanup TTL >= quota period.
     */
    private void validateUploadQuotaCleanupTtl() {
        Long quotaHours = parsePositiveHours(
                environment.getProperty("app.uploads.quota.user-period-hours"), "UPLOAD_QUOTA_USER_PERIOD_HOURS");
        Long cleanupHours = parsePositiveHours(
                environment.getProperty("app.uploads.cleanup.ttl-hours"), "UPLOAD_CLEANUP_TTL_HOURS");

        if (cleanupHours < quotaHours) {
            throw new IllegalStateException(
                    "Production upload configuration is unsafe: UPLOAD_CLEANUP_TTL_HOURS (" + cleanupHours
                            + ") must be greater than or equal to UPLOAD_QUOTA_USER_PERIOD_HOURS (" + quotaHours
                            + "). The rolling quota is computed from uploaded_files rows; a shorter cleanup TTL "
                            + "would delete rows before the quota window expires and release the consumed quota early. "
                            + "Raise UPLOAD_CLEANUP_TTL_HOURS or lower UPLOAD_QUOTA_USER_PERIOD_HOURS."
            );
        }
    }

    private static Long parsePositiveHours(String raw, String settingName) {
        if (isBlank(raw)) {
            throw new IllegalStateException(
                    "Production upload configuration requires " + settingName + " to be set to a positive integer."
            );
        }
        try {
            long value = Long.parseLong(raw.trim());
            if (value <= 0) {
                throw new NumberFormatException("non-positive");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new IllegalStateException(
                    settingName + " must be a positive integer number of hours (found: '" + raw + "').", e
            );
        }
    }

    private void validateMail() {
        String provider = mailProperties.getProvider();
        if (provider == null || "mock".equalsIgnoreCase(provider.trim())) {
            throw new IllegalStateException(
                    "Production environment must not use 'mock' email provider. Please configure app.mail.provider=brevo and set BREVO_API_KEY."
            );
        }

        if ("brevo".equalsIgnoreCase(provider.trim())) {
            MailProperties.Brevo brevo = mailProperties.getBrevo();
            if (brevo == null || brevo.getApiKey() == null || brevo.getApiKey().isBlank()) {
                throw new IllegalStateException(
                        "Production environment requires a non-blank Brevo API key (app.mail.brevo.api-key / BREVO_API_KEY)."
                );
            }
            if (brevo.getSenderEmail() == null || brevo.getSenderEmail().isBlank() || !brevo.getSenderEmail().contains("@")) {
                throw new IllegalStateException(
                        "Production environment requires a valid Brevo sender email (app.mail.brevo.sender-email / BREVO_SENDER_EMAIL)."
                );
            }
        } else {
            throw new IllegalStateException(
                    "Unsupported production mail provider: '" + provider + "'. Supported provider: 'brevo'."
            );
        }
    }

    private void validateForgotPasswordSecret() {
        String secret = rateLimitProperties.getForgotPasswordSecret();
        if (secret == null || secret.isBlank() || DEFAULT_FORGOT_PASSWORD_SECRET.equals(secret.trim())) {
            throw new IllegalStateException(
                    "Production environment must not use the default or blank forgot-password HMAC secret. " +
                    "Please configure a strong, random secret key via FORGOT_PASSWORD_SECRET."
            );
        }
        if (secret.trim().length() < 32) {
            throw new IllegalStateException(
                    "Production forgot-password secret must be at least 32 characters long for cryptographic security."
            );
        }
    }

    private void validateFrontendBaseUrl() {
        String frontendBaseUrl = mailProperties.getFrontendBaseUrl();
        if (frontendBaseUrl == null || frontendBaseUrl.isBlank()) {
            throw new IllegalStateException(
                    "Production environment requires a non-blank frontend base URL (app.mail.frontend-base-url / FRONTEND_BASE_URL)."
            );
        }
        try {
            URI uri = URI.create(frontendBaseUrl.trim());
            if (!uri.isAbsolute() || uri.getScheme() == null || !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException(
                        "Production frontend base URL must be an absolute URL with HTTPS scheme for secure reset links. Found scheme: " + uri.getScheme()
                );
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalStateException(
                        "Production frontend base URL must have a valid host name."
                );
            }
            if (uri.getUserInfo() != null) {
                throw new IllegalStateException(
                        "Production frontend base URL must not contain embedded user credentials."
                );
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Production frontend base URL is malformed: " + e.getMessage(), e
            );
        }
    }

    private void validateGoogleLogin() {
        if (googleSecurityProperties != null && googleSecurityProperties.isEnabled()) {
            String googleClientId = googleSecurityProperties.getClientId();
            if (googleClientId == null || googleClientId.isBlank()) {
                throw new IllegalStateException(
                        "Production environment has Google authentication enabled (app.security.google.enabled=true), " +
                        "but 'app.security.google.client-id' / GOOGLE_CLIENT_ID is missing or blank."
                );
            }
        }
    }

    private void validateCors() {
        List<String> origins = corsProperties.getAllowedOrigins();
        List<String> patterns = corsProperties.getAllowedOriginPatterns();

        if (origins.isEmpty() && patterns.isEmpty()) {
            throw new IllegalStateException(
                    "Production environment requires at least one allowed CORS origin. " +
                    "Set CORS_ALLOWED_ORIGINS to the Cloudflare Pages/custom domain, or CORS_ALLOWED_ORIGIN_PATTERNS for approved preview domains."
            );
        }

        for (String origin : origins) {
            validateCorsOrigin(origin);
        }
        for (String pattern : patterns) {
            validateCorsPattern(pattern);
        }
    }

    private void validateCorsOrigin(String origin) {
        if (origin.contains("*")) {
            throw new IllegalStateException(
                    "Production CORS origins must not contain wildcards. Found: " + origin
            );
        }
        if (origin.contains(",") || origin.contains(" ")) {
            throw new IllegalStateException(
                    "Production CORS origin is malformed: " + origin
            );
        }

        URI uri;
        try {
            uri = URI.create(origin);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Production CORS origin is malformed: " + origin, e);
        }

        if (!uri.isAbsolute() || uri.getScheme() == null) {
            throw new IllegalStateException("Production CORS origin must be an absolute URL: " + origin);
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalStateException("Production CORS origins must use HTTPS. Found: " + origin);
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalStateException("Production CORS origin must have a valid host name: " + origin);
        }
        if (isLocalHost(uri.getHost())) {
            throw new IllegalStateException(
                    "Production CORS origins must not point to localhost. Found: " + origin
            );
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalStateException("Production CORS origin must not contain embedded credentials: " + origin);
        }
        if ((uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null) {
            throw new IllegalStateException(
                    "Production CORS origin must not contain a path, query, or fragment: " + origin
            );
        }
    }

    private void validateCorsPattern(String pattern) {
        if ("*".equals(pattern)) {
            throw new IllegalStateException(
                    "Production CORS origin patterns must not be an unrestricted wildcard '*'. " +
                    "Use a restricted pattern such as https://*.shareloop.pages.dev."
            );
        }
        if (!pattern.regionMatches(true, 0, "https://", 0, "https://".length())) {
            throw new IllegalStateException(
                    "Production CORS origin patterns must use HTTPS. Found: " + pattern
            );
        }

        String remainder = pattern.substring("https://".length());
        if (remainder.isBlank()
                || remainder.contains("/")
                || remainder.contains("?")
                || remainder.contains("#")
                || remainder.contains(" ")) {
            throw new IllegalStateException("Production CORS origin pattern is malformed: " + pattern);
        }

        String host = extractHost(remainder);
        if (host.isBlank()) {
            throw new IllegalStateException("Production CORS origin pattern must have a valid host: " + pattern);
        }
        if (isLocalHost(host)) {
            throw new IllegalStateException("Production CORS origin patterns must not point to localhost. Found: " + pattern);
        }
        if (host.contains("*")) {
            boolean leadingLabelWildcard = host.startsWith("*.") && host.indexOf('*', 1) < 0;
            if (!leadingLabelWildcard) {
                throw new IllegalStateException(
                        "Production CORS origin patterns may only use a leading '*.' label. Found: " + pattern
                );
            }
        }
    }

    private void validateStorage() {
        String provider = storageProperties.getProvider();
        if (provider == null || provider.isBlank()) {
            throw new IllegalStateException(
                    "Production environment requires an explicit storage provider (app.storage.provider / STORAGE_PROVIDER)."
            );
        }
        if (!"r2".equalsIgnoreCase(provider.trim())) {
            throw new IllegalStateException(
                    "Production environment must use Cloudflare R2 object storage because the Render filesystem is ephemeral. " +
                    "Set STORAGE_PROVIDER=r2 (found: '" + provider + "')."
            );
        }

        StorageProperties.R2 r2 = storageProperties.getR2();
        if (r2 == null || isBlank(r2.getEndpoint())) {
            throw new IllegalStateException(
                    "Production R2 storage requires a non-blank endpoint (app.storage.r2.endpoint / R2_ENDPOINT)."
            );
        }
        validateHttpsUrl(r2.getEndpoint(), "R2_ENDPOINT");
        if (isBlank(r2.getBucketName())) {
            throw new IllegalStateException(
                    "Production R2 storage requires a non-blank bucket name (app.storage.r2.bucket-name / R2_BUCKET_NAME)."
            );
        }
        if (isBlank(r2.getAccessKeyId())) {
            throw new IllegalStateException(
                    "Production R2 storage requires a non-blank access key id (app.storage.r2.access-key-id / R2_ACCESS_KEY_ID)."
            );
        }
        if (isBlank(r2.getSecretAccessKey())) {
            throw new IllegalStateException(
                    "Production R2 storage requires a non-blank secret access key (app.storage.r2.secret-access-key / R2_SECRET_ACCESS_KEY)."
            );
        }
        if (!isBlank(r2.getPublicUrlPrefix())) {
            validateHttpsUrl(r2.getPublicUrlPrefix(), "R2_PUBLIC_URL_PREFIX");
        }
    }

    private void validateDatasource() {
        String url = environment.getProperty("spring.datasource.url");
        if (isBlank(url)) {
            throw new IllegalStateException(
                    "Production environment requires a database URL (spring.datasource.url / SPRING_DATASOURCE_URL)."
            );
        }
        if (!url.startsWith(POSTGRES_JDBC_PREFIX)) {
            throw new IllegalStateException(
                    "Production database URL must be a PostgreSQL JDBC URL (jdbc:postgresql://...)."
            );
        }

        String authority = url.substring(POSTGRES_JDBC_PREFIX.length());
        int pathIndex = authority.indexOf('/');
        if (pathIndex >= 0) {
            authority = authority.substring(0, pathIndex);
        }
        int queryIndex = authority.indexOf('?');
        if (queryIndex >= 0) {
            authority = authority.substring(0, queryIndex);
        }
        if (authority.isBlank()) {
            throw new IllegalStateException("Production database URL is missing a host.");
        }

        for (String hostEntry : authority.split(",")) {
            String host = extractHost(stripCredentials(hostEntry.trim()));
            if (host.isBlank()) {
                throw new IllegalStateException("Production database URL contains an empty host.");
            }
            if (isLocalHost(host)) {
                throw new IllegalStateException(
                        "Production database URL must not point to localhost. Configure the Neon endpoint via SPRING_DATASOURCE_URL."
                );
            }
        }

        String sslMode = environment.getProperty("spring.datasource.hikari.data-source-properties.sslmode", "require");
        String normalizedSslMode = sslMode == null ? "" : sslMode.trim().toLowerCase(Locale.ROOT);
        if (!SECURE_SSL_MODES.contains(normalizedSslMode)) {
            throw new IllegalStateException(
                    "Production database connections must use SSL (sslmode=require, verify-ca, or verify-full). Found: '" + sslMode + "'."
            );
        }
    }

    private void validateFlyway() {
        String flywayUrl = environment.getProperty("spring.flyway.url");
        if (isBlank(flywayUrl)) {
            // Flyway reuses the application datasource; validateDatasource() already enforced SSL.
            return;
        }

        if (!flywayUrl.startsWith(POSTGRES_JDBC_PREFIX)) {
            throw new IllegalStateException(
                    "Production Flyway URL must be a PostgreSQL JDBC URL (spring.flyway.url / SPRING_FLYWAY_URL)."
            );
        }

        String authority = flywayUrl.substring(POSTGRES_JDBC_PREFIX.length());
        int pathIndex = authority.indexOf('/');
        if (pathIndex >= 0) {
            authority = authority.substring(0, pathIndex);
        }
        int queryIndex = authority.indexOf('?');
        if (queryIndex >= 0) {
            authority = authority.substring(0, queryIndex);
        }
        String host = extractHost(stripCredentials(authority.trim()));
        if (host.isBlank() || isLocalHost(host)) {
            throw new IllegalStateException(
                    "Production Flyway URL must point to the Neon direct endpoint, not localhost."
            );
        }

        String sslMode = extractQueryParameter(flywayUrl, "sslmode");
        String normalizedSslMode = sslMode == null ? "" : sslMode.trim().toLowerCase(Locale.ROOT);
        if (!SECURE_SSL_MODES.contains(normalizedSslMode)) {
            throw new IllegalStateException(
                    "Production Flyway connections must use SSL. Add sslmode=require, verify-ca or verify-full " +
                            "to SPRING_FLYWAY_URL (found: '" + sslMode + "')."
            );
        }

        if (isBlank(environment.getProperty("spring.flyway.user"))
                || isBlank(environment.getProperty("spring.flyway.password"))) {
            throw new IllegalStateException(
                    "A separate Flyway endpoint requires spring.flyway.user and spring.flyway.password " +
                            "(SPRING_FLYWAY_USER / SPRING_FLYWAY_PASSWORD)."
            );
        }
    }

    private static String extractQueryParameter(String url, String name) {
        int queryStart = url.indexOf('?');
        if (queryStart < 0 || queryStart == url.length() - 1) {
            return null;
        }
        String query = url.substring(queryStart + 1);
        for (String part : query.split("&")) {
            int equals = part.indexOf('=');
            if (equals > 0 && part.substring(0, equals).equalsIgnoreCase(name)) {
                return part.substring(equals + 1);
            }
        }
        return null;
    }

    private void validateHttpsUrl(String value, String settingName) {
        URI uri;
        try {
            uri = URI.create(value.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Production " + settingName + " is malformed.", e);
        }
        if (!uri.isAbsolute() || uri.getScheme() == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalStateException("Production " + settingName + " must be an absolute HTTPS URL.");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalStateException("Production " + settingName + " must have a valid host.");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalStateException("Production " + settingName + " must not contain embedded credentials.");
        }
    }

    private static String stripCredentials(String authorityHost) {
        int at = authorityHost.lastIndexOf('@');
        return at >= 0 ? authorityHost.substring(at + 1) : authorityHost;
    }

    private static String extractHost(String authorityHost) {
        if (authorityHost.startsWith("[")) {
            int close = authorityHost.indexOf(']');
            return close > 0 ? authorityHost.substring(1, close) : authorityHost;
        }
        int colon = authorityHost.lastIndexOf(':');
        return colon > 0 ? authorityHost.substring(0, colon) : authorityHost;
    }

    private static boolean isLocalHost(String host) {
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return "localhost".equals(normalized)
                || normalized.endsWith(".localhost")
                || "127.0.0.1".equals(normalized)
                || "0.0.0.0".equals(normalized)
                || "::1".equals(normalized);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
