package com.shareloop.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionProfileEnvironmentPostProcessorTest {

    private MockEnvironment environment;
    private ProductionProfileEnvironmentPostProcessor postProcessor;

    @BeforeEach
    void setUp() {
        environment = validProductionEnvironment();
        postProcessor = new ProductionProfileEnvironmentPostProcessor();
    }

    private static MockEnvironment validProductionEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("app.mail.provider", "brevo");
        environment.setProperty("app.mail.brevo.api-key", "test-brevo-key");
        environment.setProperty("app.mail.brevo.sender-email", "no-reply@shareloop.vn");
        environment.setProperty("app.mail.frontend-base-url", "https://shareloop.pages.dev");
        environment.setProperty("app.security.rate-limit.forgot-password-secret",
                "0123456789abcdef0123456789abcdef");
        environment.setProperty("app.cors.allowed-origins[0]", "https://shareloop.pages.dev");
        environment.setProperty("app.storage.provider", "r2");
        environment.setProperty("app.storage.r2.endpoint", "https://account.r2.cloudflarestorage.com");
        environment.setProperty("app.storage.r2.bucket-name", "shareloop");
        environment.setProperty("app.storage.r2.access-key-id", "access-key");
        environment.setProperty("app.storage.r2.secret-access-key", "secret-key");
        environment.setProperty("spring.datasource.url",
                "jdbc:postgresql://ep-example.neon.tech/shareloop?sslmode=require");
        environment.setProperty("spring.datasource.hikari.data-source-properties.sslmode", "require");
        environment.setProperty("server.forward-headers-strategy", "none");
        environment.setProperty("app.uploads.quota.user-period-hours", "24");
        environment.setProperty("app.uploads.cleanup.ttl-hours", "48");
        return environment;
    }

    @Test
    @DisplayName("Runs after ConfigDataEnvironmentPostProcessor so YAML and env vars are available")
    void runsAfterConfigData() {
        assertThat(postProcessor.getOrder()).isGreaterThan(Ordered.HIGHEST_PRECEDENCE + 10);
    }

    @Test
    @DisplayName("Render deployment without prod profile fails before context startup")
    void renderWithoutProdProfileFails() {
        environment.setActiveProfiles("dev");
        environment.setProperty("RENDER", "true");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE=prod");
    }

    @Test
    @DisplayName("Render service id without prod profile fails before context startup")
    void renderServiceIdWithoutProdProfileFails() {
        environment.setActiveProfiles("staging");
        environment.setProperty("RENDER_SERVICE_ID", "srv-example");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.MISSING_PROD_PROFILE_MESSAGE);
    }

    @Test
    @DisplayName("APP_ENV=production without prod profile fails before context startup")
    void appEnvProductionWithoutProdProfileFails() {
        environment.setActiveProfiles("dev");
        environment.setProperty("APP_ENV", "production");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.CONFLICTING_ENVIRONMENT_MESSAGE);
    }

    @Test
    @DisplayName("APP_ENV=prod without prod profile fails before context startup")
    void appEnvProdWithoutProdProfileFails() {
        environment.setProperty("APP_ENV", "prod");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.MISSING_PROD_PROFILE_MESSAGE);
    }

    @Test
    @DisplayName("APP_ENV=staging without the prod profile fails as missing production configuration")
    void appEnvStagingWithoutProdProfileFails() {
        environment.setProperty("APP_ENV", "staging");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.MISSING_PROD_PROFILE_MESSAGE);
    }

    @Test
    @DisplayName("APP_ENV=staging with a valid prod profile passes")
    void appEnvStagingWithProdProfilePasses() {
        environment.setActiveProfiles("prod");
        environment.setProperty("APP_ENV", "staging");

        assertThatCode(() -> postProcessor.postProcessEnvironment(environment, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("APP_ENV=development with the prod profile fails as conflicting")
    void appEnvDevelopmentWithProdProfileFails() {
        environment.setActiveProfiles("prod");
        environment.setProperty("APP_ENV", "development");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.DEVELOPMENT_WITH_PROD_PROFILE_MESSAGE);
    }

    @Test
    @DisplayName("A blank APP_ENV is treated as undeclared")
    void blankAppEnvTreatedAsUndeclared() {
        MockEnvironment local = new MockEnvironment();
        local.setActiveProfiles("dev");
        local.setProperty("APP_ENV", "  ");

        assertThatCode(() -> postProcessor.postProcessEnvironment(local, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Unsupported APP_ENV fails with an actionable message")
    void unsupportedAppEnvFails() {
        environment.setProperty("APP_ENV", "preview");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ProductionProfileEnvironmentPostProcessor.UNSUPPORTED_APP_ENV_MESSAGE);
    }

    @Test
    @DisplayName("Explicit local development without production markers passes")
    void explicitLocalDevelopmentPasses() {
        MockEnvironment local = new MockEnvironment();
        local.setActiveProfiles("dev");
        local.setProperty("APP_ENV", "development");

        assertThatCode(() -> postProcessor.postProcessEnvironment(local, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Normal local development without any declared environment passes")
    void normalLocalDevelopmentPasses() {
        MockEnvironment local = new MockEnvironment();

        assertThatCode(() -> postProcessor.postProcessEnvironment(local, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Valid Render production deployment passes")
    void validRenderProductionPasses() {
        environment.setActiveProfiles("prod");
        environment.setProperty("RENDER", "true");
        environment.setProperty("APP_ENV", "production");

        assertThatCode(() -> postProcessor.postProcessEnvironment(environment, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Valid non-Render production deployment passes")
    void validNonRenderProductionPasses() {
        environment.setActiveProfiles("prod");
        environment.setProperty("APP_ENV", "prod");

        assertThatCode(() -> postProcessor.postProcessEnvironment(environment, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Invalid production configuration fails even when the profile is correct")
    void invalidProductionConfigurationFailsEarly() {
        environment.setActiveProfiles("prod");
        environment.setProperty("app.mail.provider", "mock");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock");
    }

    @Test
    @DisplayName("Production with framework forwarding enabled fails early")
    void frameworkForwardingRejectedEarly() {
        environment.setActiveProfiles("prod");
        environment.setProperty("server.forward-headers-strategy", "framework");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("forward-headers-strategy=none");
    }

    @Test
    @DisplayName("TRUSTED_CIDR without configured proxies fails early")
    void trustedCidrWithoutProxiesFailsEarly() {
        environment.setActiveProfiles("prod");
        environment.setProperty("app.security.rate-limit.client-ip-mode", "TRUSTED_CIDR");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TRUSTED_PROXIES");
    }

    @Test
    @DisplayName("Error messages never contain configured secret values")
    void errorMessagesDoNotLeakSecrets() {
        environment.setActiveProfiles("prod");
        environment.setProperty("app.mail.provider", "mock");
        environment.setProperty("app.mail.brevo.api-key", "super-secret-brevo-key");
        environment.setProperty("app.storage.r2.secret-access-key", "super-secret-r2-key");

        assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .satisfies(error -> assertThat(error.getMessage())
                        .doesNotContain("super-secret-brevo-key")
                        .doesNotContain("super-secret-r2-key"));
    }
}
