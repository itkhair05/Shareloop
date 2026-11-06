package com.shareloop.config;

import com.shareloop.security.google.GoogleSecurityProperties;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MailProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionConfigurationValidatorTest {

    private MockEnvironment environment;
    private MailProperties mailProperties;
    private RateLimitProperties rateLimitProperties;
    private GoogleSecurityProperties googleSecurityProperties;
    private CorsProperties corsProperties;
    private StorageProperties storageProperties;
    private ProductionConfigurationValidator validator;

    private static final String STRONG_SECRET = "super-secret-hmac-salt-key-that-is-longer-than-32-chars-for-testing!";
    private static final String NEON_JDBC_URL =
            "jdbc:postgresql://ep-example-123.us-east-2.aws.neon.tech/shareloop?sslmode=require";

    @BeforeEach
    void setUp() {
        environment = new MockEnvironment();
        mailProperties = new MailProperties();
        rateLimitProperties = new RateLimitProperties();
        googleSecurityProperties = new GoogleSecurityProperties();
        corsProperties = new CorsProperties();
        storageProperties = new StorageProperties();

        environment.setProperty("spring.datasource.url", NEON_JDBC_URL);
        environment.setProperty("spring.datasource.hikari.data-source-properties.sslmode", "require");
        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        environment.setProperty("app.uploads.cleanup.ttl-hours", "48");

        corsProperties.setAllowedOrigins(List.of("https://shareloop.vn"));

        storageProperties.setProvider("r2");
        storageProperties.getR2().setEndpoint("https://example-account.r2.cloudflarestorage.com");
        storageProperties.getR2().setBucketName("shareloop-media");
        storageProperties.getR2().setAccessKeyId("test-access-key-id");
        storageProperties.getR2().setSecretAccessKey("test-secret-access-key");

        validator = new ProductionConfigurationValidator(
                environment,
                mailProperties,
                rateLimitProperties,
                googleSecurityProperties,
                corsProperties,
                storageProperties
        );
    }

    @Test
    @DisplayName("Non-production profile allows mock provider and default secret")
    void nonProductionAllowsMockAndDefaultSecret() {
        environment.setActiveProfiles("test");
        mailProperties.setProvider("mock");
        rateLimitProperties.setForgotPasswordSecret("shareloop-forgot-password-salt-key-default");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile with mock provider throws IllegalStateException")
    void productionWithMockProviderThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("mock");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production environment must not use 'mock' email provider");
    }

    @Test
    @DisplayName("Production profile with brevo provider but missing API key throws IllegalStateException")
    void productionWithBrevoMissingApiKeyThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requires a non-blank Brevo API key");
    }

    @Test
    @DisplayName("Production profile with brevo provider but invalid sender email throws IllegalStateException")
    void productionWithBrevoInvalidSenderEmailThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("valid-key");
        mailProperties.getBrevo().setSenderEmail("not-an-email");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requires a valid Brevo sender email");
    }

    @Test
    @DisplayName("Production profile with default forgot-password secret throws IllegalStateException")
    void productionWithDefaultSecretThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("valid-key");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret("shareloop-forgot-password-salt-key-default");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production environment must not use the default or blank forgot-password HMAC secret");
    }

    @Test
    @DisplayName("Production profile with short secret (<32 chars) throws IllegalStateException")
    void productionWithShortSecretThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("valid-key");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret("short-secret-under-32-chars");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be at least 32 characters long");
    }

    @Test
    @DisplayName("Production profile with valid Brevo configuration, strong secret, and HTTPS URL passes validation")
    void productionWithValidConfigPasses() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile with HTTP frontend URL throws IllegalStateException")
    void productionWithHttpFrontendUrlThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("http://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be an absolute URL with HTTPS scheme");
    }

    @Test
    @DisplayName("Production profile with blank frontend URL throws IllegalStateException")
    void productionWithBlankFrontendUrlThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requires a non-blank frontend base URL");
    }

    @Test
    @DisplayName("Production profile with missing scheme in frontend URL throws IllegalStateException")
    void productionWithMissingSchemeThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be an absolute URL with HTTPS scheme");
    }

    @Test
    @DisplayName("Production profile with non-HTTPS scheme (ftp) throws IllegalStateException")
    void productionWithNonHttpsSchemeThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("ftp://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be an absolute URL with HTTPS scheme");
    }

    @Test
    @DisplayName("Production profile with user credentials in frontend URL throws IllegalStateException")
    void productionWithUserInfoInFrontendUrlThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://admin:secret@shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not contain embedded user credentials");
    }

    @Test
    @DisplayName("Production profile with malformed URL throws IllegalStateException")
    void productionWithMalformedUrlThrowsIllegalStateException() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://::invalid::url");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("frontend base URL");
    }

    @Test
    @DisplayName("Non-production environment allows local HTTP frontend URL")
    void nonProductionAllowsLocalHttpFrontendUrl() {
        environment.setActiveProfiles("dev");
        mailProperties.setProvider("mock");
        mailProperties.setFrontendBaseUrl("http://localhost:5173");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile with Google login disabled passes even if client ID is blank")
    void productionWithGoogleDisabledPasses() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);
        googleSecurityProperties.setEnabled(false);
        googleSecurityProperties.setClientId("");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile with Google login enabled but blank client ID throws IllegalStateException")
    void productionWithGoogleEnabledAndMissingClientIdThrows() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);
        googleSecurityProperties.setEnabled(true);
        googleSecurityProperties.setClientId("   ");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GOOGLE_CLIENT_ID is missing or blank");
    }

    @Test
    @DisplayName("Production profile with Google login enabled and valid client ID passes")
    void productionWithGoogleEnabledAndValidClientIdPasses() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);
        googleSecurityProperties.setEnabled(true);
        googleSecurityProperties.setClientId("1234567890-test.apps.googleusercontent.com");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Render deployment without the prod profile fails fast")
    void productionDeploymentWithoutProdProfileFails() {
        environment.setActiveProfiles("dev");
        environment.setProperty("RENDER", "true");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE=prod");
    }

    @Test
    @DisplayName("APP_ENV=production without the prod profile fails fast")
    void appEnvProductionWithoutProdProfileFails() {
        environment.setActiveProfiles("staging");
        environment.setProperty("APP_ENV", "production");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE=prod");
    }

    @Test
    @DisplayName("Production profile without CORS origins or patterns fails fast")
    void productionWithoutCorsConfigurationFails() {
        givenValidProductionBase();
        corsProperties.setAllowedOrigins(List.of());
        corsProperties.setAllowedOriginPatterns(List.of());

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least one allowed CORS origin");
    }

    @Test
    @DisplayName("Production profile with an HTTP CORS origin fails fast")
    void productionWithHttpCorsOriginFails() {
        givenValidProductionBase();
        corsProperties.setAllowedOrigins(List.of("http://shareloop.vn"));

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must use HTTPS");
    }

    @Test
    @DisplayName("Production profile with a localhost CORS origin fails fast")
    void productionWithLocalhostCorsOriginFails() {
        givenValidProductionBase();
        corsProperties.setAllowedOrigins(List.of("https://localhost:5173"));

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not point to localhost");
    }

    @Test
    @DisplayName("Production profile with a wildcard CORS origin fails fast")
    void productionWithWildcardCorsOriginFails() {
        givenValidProductionBase();
        corsProperties.setAllowedOrigins(List.of("*"));

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not contain wildcards");
    }

    @Test
    @DisplayName("Production profile with a restricted Cloudflare Pages preview pattern passes")
    void productionWithPagesPreviewPatternPasses() {
        givenValidProductionBase();
        corsProperties.setAllowedOrigins(List.of("https://shareloop.vn"));
        corsProperties.setAllowedOriginPatterns(List.of("https://*.shareloop.pages.dev"));

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile with local storage fails fast")
    void productionWithLocalStorageFails() {
        givenValidProductionBase();
        storageProperties.setProvider("local");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must use Cloudflare R2");
    }

    @Test
    @DisplayName("Production profile with missing R2 secret fails fast")
    void productionWithMissingR2SecretFails() {
        givenValidProductionBase();
        storageProperties.getR2().setSecretAccessKey("");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R2_SECRET_ACCESS_KEY");
    }

    @Test
    @DisplayName("Production profile with an HTTP R2 endpoint fails fast")
    void productionWithHttpR2EndpointFails() {
        givenValidProductionBase();
        storageProperties.getR2().setEndpoint("http://example-account.r2.cloudflarestorage.com");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R2_ENDPOINT must be an absolute HTTPS URL");
    }

    @Test
    @DisplayName("Production profile with a localhost database URL fails fast")
    void productionWithLocalhostDatabaseFails() {
        givenValidProductionBase();
        environment.setProperty("spring.datasource.url", "jdbc:postgresql://localhost:5432/shareloop_db");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not point to localhost");
    }

    @Test
    @DisplayName("Production profile with SSL disabled fails fast")
    void productionWithInsecureSslModeFails() {
        givenValidProductionBase();
        environment.setProperty("spring.datasource.hikari.data-source-properties.sslmode", "disable");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must use SSL");
    }

    @Test
    @DisplayName("Production profile accepts a separate Flyway direct endpoint with SSL and credentials")
    void productionWithFlywayDirectEndpointPasses() {
        givenValidProductionBase();
        environment.setProperty("spring.flyway.url",
                "jdbc:postgresql://ep-direct-123.us-east-2.aws.neon.tech/shareloop?sslmode=require");
        environment.setProperty("spring.flyway.user", "shareloop_migrator");
        environment.setProperty("spring.flyway.password", "migrator-password");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production profile rejects a Flyway endpoint without SSL")
    void productionWithFlywayUrlWithoutSslFails() {
        givenValidProductionBase();
        environment.setProperty("spring.flyway.url",
                "jdbc:postgresql://ep-direct-123.us-east-2.aws.neon.tech/shareloop");
        environment.setProperty("spring.flyway.user", "shareloop_migrator");
        environment.setProperty("spring.flyway.password", "migrator-password");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Flyway connections must use SSL");
    }

    @Test
    @DisplayName("Production profile rejects a Flyway endpoint without credentials")
    void productionWithFlywayUrlWithoutCredentialsFails() {
        givenValidProductionBase();
        environment.setProperty("spring.flyway.url",
                "jdbc:postgresql://ep-direct-123.us-east-2.aws.neon.tech/shareloop?sslmode=require");
        environment.setProperty("spring.flyway.user", "shareloop_migrator");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_FLYWAY_PASSWORD");
    }

    @Test
    @DisplayName("Production profile rejects a localhost Flyway endpoint")
    void productionWithFlywayLocalhostFails() {
        givenValidProductionBase();
        environment.setProperty("spring.flyway.url",
                "jdbc:postgresql://localhost:5432/shareloop?sslmode=require");
        environment.setProperty("spring.flyway.user", "shareloop_migrator");
        environment.setProperty("spring.flyway.password", "migrator-password");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must point to the Neon direct endpoint");
    }

    @Test
    @DisplayName("Production profile rejects a non-PostgreSQL Flyway URL")
    void productionWithNonPostgresFlywayUrlFails() {
        givenValidProductionBase();
        environment.setProperty("spring.flyway.url", "jdbc:mysql://db.example.com/shareloop?sslmode=require");
        environment.setProperty("spring.flyway.user", "shareloop_migrator");
        environment.setProperty("spring.flyway.password", "migrator-password");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be a PostgreSQL JDBC URL");
    }

    @Test
    @DisplayName("Production rejects framework forwarding because it rewrites the remote address")
    void productionRejectsFrameworkForwarding() {
        givenValidProductionBase();
        environment.setProperty("server.forward-headers-strategy", "framework");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("forward-headers-strategy=none");
    }

    @Test
    @DisplayName("Production accepts an explicit 'none' forwarding strategy")
    void productionAcceptsNoneForwardingStrategy() {
        givenValidProductionBase();
        environment.setProperty("server.forward-headers-strategy", "none");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production accepts DIRECT client IP mode without trusted proxies")
    void productionAcceptsDirectClientIpMode() {
        givenValidProductionBase();
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.DIRECT);

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production rejects TRUSTED_CIDR without configured proxies")
    void productionRejectsTrustedCidrWithoutProxies() {
        givenValidProductionBase();
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TRUSTED_PROXIES");
    }

    @Test
    @DisplayName("Production rejects the removed TRUSTED_HOPS mode")
    void productionRejectsLegacyTrustedHops() {
        givenValidProductionBase();
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.TRUSTED_HOPS);

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TRUSTED_HOPS is no longer supported");
    }

    @Test
    @DisplayName("Production accepts a valid TRUSTED_CIDR boundary")
    void productionAcceptsValidTrustedCidr() {
        givenValidProductionBase();
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
        rateLimitProperties.setTrustedProxies(List.of("10.0.0.0/24"));

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production rejects a cleanup TTL shorter than the quota period")
    void productionRejectsCleanupTtlShorterThanQuotaPeriod() {
        givenValidProductionBase();
        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        environment.setProperty("app.uploads.cleanup.ttl-hours", "12");

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_CLEANUP_TTL_HOURS")
                .hasMessageContaining("UPLOAD_QUOTA_USER_PERIOD_HOURS");
    }

    @Test
    @DisplayName("Production accepts a cleanup TTL equal to the quota period")
    void productionAcceptsCleanupTtlEqualToQuotaPeriod() {
        givenValidProductionBase();
        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        environment.setProperty("app.uploads.cleanup.ttl-hours", "24");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production accepts a cleanup TTL greater than the quota period")
    void productionAcceptsCleanupTtlGreaterThanQuotaPeriod() {
        givenValidProductionBase();
        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        environment.setProperty("app.uploads.cleanup.ttl-hours", "48");

        assertThatCode(() -> validator.validateConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Production rejects zero or negative TTL values")
    void productionRejectsInvalidTtlValues() {
        givenValidProductionBase();
        environment.setProperty("app.uploads.quota.user-period-hours", "24");

        environment.setProperty("app.uploads.cleanup.ttl-hours", "0");
        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_CLEANUP_TTL_HOURS");

        environment.setProperty("app.uploads.cleanup.ttl-hours", "-5");
        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_CLEANUP_TTL_HOURS");

        environment.setProperty("app.uploads.cleanup.ttl-hours", "abc");
        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_CLEANUP_TTL_HOURS");
    }

    @Test
    @DisplayName("Production rejects a missing TTL or quota period value")
    void productionRejectsMissingTtlValues() {
        givenValidProductionBase();

        environment.setProperty("app.uploads.cleanup.ttl-hours", "24");
        ((org.springframework.core.env.MapPropertySource) environment.getPropertySources().iterator().next())
                .getSource().remove("app.uploads.quota.user-period-hours");
        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_QUOTA_USER_PERIOD_HOURS");

        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        ((org.springframework.core.env.MapPropertySource) environment.getPropertySources().iterator().next())
                .getSource().remove("app.uploads.cleanup.ttl-hours");
        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("UPLOAD_CLEANUP_TTL_HOURS");
    }

    @Test
    @DisplayName("Production rejects a hostname in the trusted proxy list")
    void productionRejectsHostnameTrustedProxy() {
        givenValidProductionBase();
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
        rateLimitProperties.setTrustedProxies(List.of("edge.example.com"));

        assertThatThrownBy(() -> validator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("IPv4 or IPv6 literal");
    }

    private void givenValidProductionBase() {
        environment.setActiveProfiles("prod");
        mailProperties.setProvider("brevo");
        mailProperties.getBrevo().setApiKey("xkeysib-valid-production-api-key-12345678");
        mailProperties.getBrevo().setSenderEmail("no-reply@shareloop.vn");
        mailProperties.setFrontendBaseUrl("https://shareloop.vn");
        rateLimitProperties.setForgotPasswordSecret(STRONG_SECRET);
        googleSecurityProperties.setEnabled(false);
    }
}
