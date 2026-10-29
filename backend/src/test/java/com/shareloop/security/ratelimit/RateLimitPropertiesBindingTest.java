package com.shareloop.security.ratelimit;

import com.shareloop.service.ChatService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitPropertiesBindingTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    RateLimitProperties.class,
                    ConfigurationPropertiesAutoConfiguration.class
            ));

    @Test
    @DisplayName("Default chat rate limit properties are 20 messages and 60 seconds")
    void defaultValues() {
        runner.run(context -> {
            RateLimitProperties props = context.getBean(RateLimitProperties.class);
            assertThat(props.getChatMessageLimit()).isEqualTo(20);
            assertThat(props.getChatLimit()).isEqualTo(20);
            assertThat(props.getChatWindowSeconds()).isEqualTo(60);
        });
    }

    @Test
    @DisplayName("Binds non-default chat-message-limit and chat-window-seconds correctly")
    void bindsNonDefaultChatMessageLimitAndWindow() {
        runner.withPropertyValues(
                "app.security.rate-limit.chat-message-limit=10",
                "app.security.rate-limit.chat-window-seconds=45"
        ).run(context -> {
            RateLimitProperties props = context.getBean(RateLimitProperties.class);
            assertThat(props.getChatMessageLimit()).isEqualTo(10);
            assertThat(props.getChatLimit()).isEqualTo(10);
            assertThat(props.getChatWindowSeconds()).isEqualTo(45);
        });
    }

    @Test
    @DisplayName("Binds legacy chat-limit alias property correctly to chatMessageLimit")
    void bindsLegacyChatLimitAlias() {
        runner.withPropertyValues(
                "app.security.rate-limit.chat-limit=15"
        ).run(context -> {
            RateLimitProperties props = context.getBean(RateLimitProperties.class);
            assertThat(props.getChatMessageLimit()).isEqualTo(15);
            assertThat(props.getChatLimit()).isEqualTo(15);
        });
    }

    @Nested
    @SpringBootTest
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "app.security.rate-limit.chat-message-limit=7",
            "app.security.rate-limit.chat-window-seconds=30"
    })
    class SpringBootContextBindingIntegrationTest {

        @Autowired
        private RateLimitProperties rateLimitProperties;

        @Autowired
        private ChatService chatService;

        @Test
        @DisplayName("SpringBootTest binds non-default chat rate limit properties and injects into ChatService")
        void testSpringBootTestBinding() {
            assertThat(rateLimitProperties).isNotNull();
            assertThat(rateLimitProperties.getChatMessageLimit()).isEqualTo(7);
            assertThat(rateLimitProperties.getChatWindowSeconds()).isEqualTo(30);
            assertThat(chatService).isNotNull();
        }
    }
}
