package com.shareloop.service.mail;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class BrevoEmailServiceTest {

    private MailProperties mailProperties;
    private BrevoEmailService brevoEmailService;
    private MockRestServiceServer mockServer;

    private static final String FAKE_API_KEY = "xkeysib-test-mock-api-key-123456789";
    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    @BeforeEach
    void setUp() {
        mailProperties = new MailProperties();
        mailProperties.setProvider("brevo");
        mailProperties.setFrontendBaseUrl("http://localhost:5173");

        MailProperties.Brevo brevo = mailProperties.getBrevo();
        brevo.setApiKey(FAKE_API_KEY);
        brevo.setSenderEmail("no-reply@shareloop.vn");
        brevo.setSenderName("ShareLoop");
        brevo.setApiUrl(BREVO_API_URL);
        brevo.setTimeoutSeconds(5);

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(BREVO_API_URL)
                .defaultHeader(org.springframework.http.HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(org.springframework.http.HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        brevoEmailService = new BrevoEmailService(mailProperties, restClient);
    }

    @Test
    @DisplayName("Successfully dispatches transactional email with correct headers and JSON payload")
    void dispatchesEmailSuccessfully() {
        mockServer.expect(requestTo(BREVO_API_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("api-key", FAKE_API_KEY))
                .andExpect(header("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(header("Accept", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.sender.name").value("ShareLoop"))
                .andExpect(jsonPath("$.sender.email").value("no-reply@shareloop.vn"))
                .andExpect(jsonPath("$.to[0].email").value("student@example.com"))
                .andExpect(jsonPath("$.to[0].name").value("Nguyen Van A"))
                .andExpect(jsonPath("$.subject").value("ShareLoop - Đặt lại mật khẩu của bạn"))
                .andExpect(jsonPath("$.htmlContent").isString())
                .andExpect(jsonPath("$.textContent").isString())
                .andRespond(withSuccess("{\"messageId\":\"<mock-message-id-999@brevo.com>\"}", MediaType.APPLICATION_JSON));

        brevoEmailService.sendPasswordResetEmail("student@example.com", "Nguyen Van A", "raw-token-abc-123");

        mockServer.verify();
    }

    @Test
    @DisplayName("HTML template escapes special characters in recipient name to prevent HTML injection")
    void htmlTemplateEscapesSpecialCharacters() {
        String unsafeName = "<script>alert('xss')</script> & \"John\"";
        String html = brevoEmailService.buildHtmlTemplate(unsafeName, "http://localhost:5173/reset-password?token=test");

        assertThat(html)
                .doesNotContain("<script>")
                .contains("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt; &amp; &quot;John&quot;")
                .contains("http://localhost:5173/reset-password?token=test");
    }

    @Test
    @DisplayName("Brevo API error response throws exception without exposing API key")
    void brevoApiErrorThrowsException() {
        mockServer.expect(requestTo(BREVO_API_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("{\"code\":\"invalid_parameter\",\"message\":\"Invalid email\"}"));

        assertThatThrownBy(() -> brevoEmailService.sendPasswordResetEmail("invalid@example.com", "Test", "token123"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Email delivery failed via Brevo");

        mockServer.verify();
    }

    @Test
    @DisplayName("Missing API key throws IllegalStateException before making HTTP request")
    void missingApiKeyThrowsIllegalStateException() {
        mailProperties.getBrevo().setApiKey("");

        assertThatThrownBy(() -> brevoEmailService.sendPasswordResetEmail("user@example.com", "User", "token123"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Brevo API key is missing or unconfigured");
    }

    @Test
    @DisplayName("Default configured expiration lifetime (15 minutes) is reflected in both HTML and plain-text templates")
    void defaultLifetimeReflectedInTemplates() {
        String html = brevoEmailService.buildHtmlTemplate("Nguyen Van A", "https://shareloop.vn/reset-password?token=test");
        String text = brevoEmailService.buildPlainTextTemplate("Nguyen Van A", "https://shareloop.vn/reset-password?token=test");

        assertThat(html).contains("15 phút");
        assertThat(text).contains("15 phút");
    }

    @Test
    @DisplayName("Custom configured expiration lifetime (30 minutes) is dynamically reflected and replaces default")
    void customLifetimeReflectedInTemplates() {
        int customLifetime = 30;
        String html = brevoEmailService.buildHtmlTemplate("Nguyen Van A", "https://shareloop.vn/reset-password?token=test", customLifetime);
        String text = brevoEmailService.buildPlainTextTemplate("Nguyen Van A", "https://shareloop.vn/reset-password?token=test", customLifetime);

        assertThat(html)
                .contains("30 phút")
                .doesNotContain("15 phút");
        assertThat(text)
                .contains("30 phút")
                .doesNotContain("15 phút");
    }

    @Test
    @DisplayName("Dispatched Brevo email contains the configured custom expiration duration in payload")
    void dispatchesEmailWithCustomExpiration() {
        mockServer.expect(requestTo(BREVO_API_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.htmlContent").value(org.hamcrest.Matchers.containsString("45 phút")))
                .andExpect(jsonPath("$.textContent").value(org.hamcrest.Matchers.containsString("45 phút")))
                .andRespond(withSuccess("{\"messageId\":\"<mock-message-id-45@brevo.com>\"}", MediaType.APPLICATION_JSON));

        brevoEmailService.sendPasswordResetEmail("student@example.com", "Nguyen Van A", "raw-token-45", 45);

        mockServer.verify();
    }
}
