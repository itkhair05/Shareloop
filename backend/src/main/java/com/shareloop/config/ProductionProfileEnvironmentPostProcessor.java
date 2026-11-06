package com.shareloop.config;

import com.shareloop.security.google.GoogleSecurityProperties;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Fails startup during environment preparation - before the application
 * context, Flyway migration and the web server exist - when:
 * <ul>
 *     <li>a production deployment marker is present but the 'prod' profile is missing,</li>
 *     <li>the environment declarations contradict each other, or</li>
 *     <li>production configuration is incomplete or unsafe.</li>
 * </ul>
 *
 * <p>Validation binds plain configuration-property objects from the environment;
 * no application bean is created or fetched here.</p>
 *
 * <p>Runs after {@code ConfigDataEnvironmentPostProcessor} so profile-specific
 * YAML and environment variables are already available.</p>
 *
 * Registered in META-INF/spring.factories under org.springframework.boot.env.EnvironmentPostProcessor.
 */
public class ProductionProfileEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final Logger log = LoggerFactory.getLogger(ProductionProfileEnvironmentPostProcessor.class);

    static final String MISSING_PROD_PROFILE_MESSAGE =
            "Production deployment detected (Render or APP_ENV=production) but the 'prod' Spring profile is not active. " +
            "Set SPRING_PROFILES_ACTIVE=prod so production configuration and validation are applied.";

    static final String CONFLICTING_ENVIRONMENT_MESSAGE =
            "Conflicting environment declarations: APP_ENV/Render indicates a production deployment, but the active " +
            "Spring profile is not 'prod'. Set SPRING_PROFILES_ACTIVE=prod and remove any non-production profile.";

    static final String DEVELOPMENT_WITH_PROD_PROFILE_MESSAGE =
            "Conflicting environment declarations: APP_ENV indicates development but the 'prod' Spring profile is active. " +
            "Use APP_ENV=production with SPRING_PROFILES_ACTIVE=prod, or remove APP_ENV for local development.";

    static final String UNSUPPORTED_APP_ENV_MESSAGE =
            "Unsupported APP_ENV value. Supported values: production, prod, development, dev, local, staging.";

    private static final List<String> DEVELOPMENT_PROFILES = List.of("dev", "development", "local");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String appEnv = normalize(environment.getProperty("APP_ENV"));
        if (appEnv != null && appEnv.isEmpty()) {
            appEnv = null;
        }
        boolean prodProfile = hasProfile(environment, "prod");
        boolean developmentProfile = hasAnyProfile(environment, DEVELOPMENT_PROFILES);

        boolean productionEnv = "production".equals(appEnv) || "prod".equals(appEnv);
        boolean developmentEnv = "development".equals(appEnv) || "dev".equals(appEnv) || "local".equals(appEnv);
        boolean stagingEnv = "staging".equals(appEnv);
        boolean productionLikeEnv = productionEnv || stagingEnv;
        boolean renderMarker = hasRenderMarker(environment);

        if (appEnv != null && !productionEnv && !developmentEnv && !stagingEnv) {
            throw new IllegalStateException(UNSUPPORTED_APP_ENV_MESSAGE);
        }

        // Production-like declarations must use the prod profile; development must not.
        if (productionLikeEnv && !prodProfile) {
            if (developmentProfile) {
                throw new IllegalStateException(CONFLICTING_ENVIRONMENT_MESSAGE);
            }
            throw new IllegalStateException(MISSING_PROD_PROFILE_MESSAGE);
        }

        if (developmentEnv && prodProfile) {
            throw new IllegalStateException(DEVELOPMENT_WITH_PROD_PROFILE_MESSAGE);
        }

        if (renderMarker && !prodProfile) {
            if (developmentProfile || developmentEnv) {
                throw new IllegalStateException(CONFLICTING_ENVIRONMENT_MESSAGE);
            }
            throw new IllegalStateException(MISSING_PROD_PROFILE_MESSAGE);
        }

        if (prodProfile) {
            validateProductionConfiguration(environment);
        }
    }

    /**
     * Binds configuration-property classes from the prepared environment and runs
     * the same validation used by the production deployment checks. Because this
     * happens in the EnvironmentPostProcessor phase, no DataSource, Flyway or web
     * server has been created yet.
     */
    private void validateProductionConfiguration(ConfigurableEnvironment environment) {
        log.info("Running early production configuration validation before context startup...");

        Binder binder = Binder.get(environment);
        MailProperties mailProperties = binder.bind("app.mail", Bindable.of(MailProperties.class))
                .orElseGet(MailProperties::new);
        RateLimitProperties rateLimitProperties = binder
                .bind("app.security.rate-limit", Bindable.of(RateLimitProperties.class))
                .orElseGet(RateLimitProperties::new);
        GoogleSecurityProperties googleSecurityProperties = binder
                .bind("app.security.google", Bindable.of(GoogleSecurityProperties.class))
                .orElse(null);
        CorsProperties corsProperties = binder.bind("app.cors", Bindable.of(CorsProperties.class))
                .orElseGet(CorsProperties::new);
        StorageProperties storageProperties = binder.bind("app.storage", Bindable.of(StorageProperties.class))
                .orElseGet(StorageProperties::new);

        new ProductionConfigurationValidator(
                environment,
                mailProperties,
                rateLimitProperties,
                googleSecurityProperties,
                corsProperties,
                storageProperties
        ).validateConfiguration();
    }

    private static boolean hasRenderMarker(org.springframework.core.env.Environment environment) {
        String render = normalize(environment.getProperty("RENDER"));
        String renderServiceId = normalize(environment.getProperty("RENDER_SERVICE_ID"));
        return "true".equals(render) || (renderServiceId != null && !renderServiceId.isEmpty());
    }

    static boolean isProductionDeployment(org.springframework.core.env.Environment environment) {
        return hasRenderMarker(environment)
                || "production".equals(normalize(environment.getProperty("APP_ENV")))
                || "prod".equals(normalize(environment.getProperty("APP_ENV")));
    }

    private static boolean hasProfile(ConfigurableEnvironment environment, String profile) {
        return Arrays.asList(environment.getActiveProfiles()).contains(profile);
    }

    private static boolean hasAnyProfile(ConfigurableEnvironment environment, List<String> profiles) {
        return Arrays.stream(environment.getActiveProfiles()).anyMatch(profiles::contains);
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public int getOrder() {
        // After ConfigDataEnvironmentPostProcessor (HIGHEST_PRECEDENCE + 10).
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }
}
