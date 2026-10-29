package com.shareloop.config;

import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
public class ProductionConfigurationValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProductionConfigurationValidator.class);
    public static final String DEFAULT_FORGOT_PASSWORD_SECRET = "shareloop-forgot-password-salt-key-default";

    private final Environment environment;
    private final MailProperties mailProperties;
    private final RateLimitProperties rateLimitProperties;

    public ProductionConfigurationValidator(
            Environment environment,
            MailProperties mailProperties,
            RateLimitProperties rateLimitProperties
    ) {
        this.environment = environment;
        this.mailProperties = mailProperties;
        this.rateLimitProperties = rateLimitProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        validateConfiguration();
    }

    public void validateConfiguration() {
        boolean isProduction = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!isProduction) {
            return;
        }

        log.info("Validating production configuration rules...");

        // 1. Production must not use mock email provider
        String provider = mailProperties.getProvider();
        if (provider == null || "mock".equalsIgnoreCase(provider.trim())) {
            throw new IllegalStateException(
                    "Production environment must not use 'mock' email provider. Please configure app.mail.provider=brevo and set BREVO_API_KEY."
            );
        }

        // 2. Production must require valid Brevo credentials
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

        // 3. Production must require an explicitly supplied, strong FORGOT_PASSWORD_SECRET
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

        log.info("Production configuration validation passed successfully.");
    }
}
