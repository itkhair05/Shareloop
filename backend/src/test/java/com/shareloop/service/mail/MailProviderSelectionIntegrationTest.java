package com.shareloop.service.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class MailProviderSelectionIntegrationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(MailProperties.class, BrevoEmailService.class, MockEmailService.class);

    @Test
    @DisplayName("Default configuration selects MockEmailService when app.mail.provider is not set")
    void defaultSelectsMockEmailService() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(EmailService.class);
            assertThat(context).hasSingleBean(MockEmailService.class);
            assertThat(context).doesNotHaveBean(BrevoEmailService.class);
        });
    }

    @Test
    @DisplayName("Explicit app.mail.provider=mock selects MockEmailService")
    void explicitMockSelectsMockEmailService() {
        contextRunner.withPropertyValues("app.mail.provider=mock").run(context -> {
            assertThat(context).hasSingleBean(EmailService.class);
            assertThat(context).hasSingleBean(MockEmailService.class);
            assertThat(context).doesNotHaveBean(BrevoEmailService.class);
        });
    }

    @Test
    @DisplayName("Explicit app.mail.provider=brevo instantiates BrevoEmailService via constructor injection")
    void brevoProviderSelectsBrevoEmailService() {
        contextRunner.withPropertyValues(
                "app.mail.provider=brevo",
                "app.mail.brevo.api-key=test-api-key",
                "app.mail.brevo.sender-email=sender@example.com"
        ).run(context -> {
            assertThat(context).hasSingleBean(EmailService.class);
            assertThat(context).hasSingleBean(BrevoEmailService.class);
            assertThat(context).doesNotHaveBean(MockEmailService.class);
        });
    }
}
