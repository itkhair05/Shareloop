package com.shareloop.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves that the production checks execute in the EnvironmentPostProcessor phase:
 * the application context (and therefore Flyway, the web server and every
 * ApplicationRunner, including admin bootstrap) is never created when validation
 * fails.
 */
class ProductionProfileEnvironmentPostProcessorLifecycleTest {

    @Configuration(proxyBeanMethods = false)
    static class ProbeConfiguration {

        @Bean
        ProbeBean probeBean() {
            ProbeBean.CREATED.set(true);
            return new ProbeBean();
        }
    }

    static class ProbeBean {
        static final AtomicBoolean CREATED = new AtomicBoolean(false);
    }

    private SpringApplication application() {
        SpringApplication application = new SpringApplication(ProbeConfiguration.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        // Keep the test hermetic: do not load application.yml or profile-specific YAML.
        return application;
    }

    @Test
    @DisplayName("Missing prod profile aborts before the context and its beans exist")
    void missingProdProfileAbortsBeforeContextCreation() {
        ProbeBean.CREATED.set(false);
        AtomicBoolean initializerRan = new AtomicBoolean(false);

        SpringApplication application = application();
        application.addInitializers(context -> initializerRan.set(true));

        assertThatThrownBy(() -> application.run(
                "--spring.config.name=shareloop-lifecycle-test-nonexistent",
                "--spring.profiles.active=dev",
                "--APP_ENV=production"))
                .hasStackTraceContaining("SPRING_PROFILES_ACTIVE=prod");

        assertThat(initializerRan).as("Context initializers must not run").isFalse();
        assertThat(ProbeBean.CREATED).as("Application beans must not be created").isFalse();
    }

    @Test
    @DisplayName("Invalid production configuration aborts before the context and its beans exist")
    void invalidProductionConfigurationAbortsBeforeContextCreation() {
        ProbeBean.CREATED.set(false);
        AtomicBoolean initializerRan = new AtomicBoolean(false);

        SpringApplication application = application();
        application.addInitializers(context -> initializerRan.set(true));

        assertThatThrownBy(() -> application.run(
                "--spring.config.name=shareloop-lifecycle-test-nonexistent",
                "--spring.profiles.active=prod",
                "--app.mail.provider=mock"))
                .hasStackTraceContaining("must not use 'mock' email provider");

        assertThat(initializerRan).as("Context initializers must not run").isFalse();
        assertThat(ProbeBean.CREATED).as("Application beans must not be created").isFalse();
    }

    @Test
    @DisplayName("Validation failure is raised during environment preparation, not context refresh")
    void failureHappensDuringEnvironmentPreparation() {
        SpringApplication application = application();

        assertThatThrownBy(() -> application.run(
                "--spring.config.name=shareloop-lifecycle-test-nonexistent",
                "--APP_ENV=production"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE=prod");
    }
}
