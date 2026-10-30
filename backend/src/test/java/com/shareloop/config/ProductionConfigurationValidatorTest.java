package com.shareloop.config;

import com.shareloop.security.google.GoogleSecurityProperties;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MailProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionConfigurationValidatorTest {

    private MockEnvironment environment;
    private MailProperties mailProperties;
    private RateLimitProperties rateLimitProperties;
    private GoogleSecurityProperties googleSecurityProperties;
    private ProductionConfigurationValidator validator;

    private static final String STRONG_SECRET = "super-secret-hmac-salt-key-that-is-longer-than-32-chars-for-testing!";

    @BeforeEach
    void setUp() {
        environment = new MockEnvironment();
        mailProperties = new MailProperties();
        rateLimitProperties = new RateLimitProperties();
        googleSecurityProperties = new GoogleSecurityProperties();
        validator = new ProductionConfigurationValidator(environment, mailProperties, rateLimitProperties, googleSecurityProperties);
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
}
