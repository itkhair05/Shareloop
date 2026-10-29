package com.shareloop.service.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "mock", matchIfMissing = true)
public class MockEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(MockEmailService.class);

    private final MailProperties mailProperties;
    private final List<SentResetEmail> sentEmails = new CopyOnWriteArrayList<>();
    private volatile boolean shouldFail = false;

    public MockEmailService(MailProperties mailProperties) {
        this.mailProperties = mailProperties;
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String recipientName, String resetToken) {
        if (shouldFail) {
            log.error("Simulated email delivery failure for recipient domain {}", getDomain(toEmail));
            throw new RuntimeException("Simulated email service delivery failure");
        }

        String resetUrl = mailProperties.getFrontendBaseUrl() + "/reset-password?token=" + resetToken;
        SentResetEmail record = new SentResetEmail(toEmail, recipientName, resetToken, resetUrl, Instant.now());
        sentEmails.add(record);

        // Intentionally do NOT log raw resetToken or resetUrl at INFO/WARN
        log.info("Mock email service: Queued password reset email for recipient domain {}", getDomain(toEmail));
    }

    private String getDomain(String email) {
        if (email == null || !email.contains("@")) {
            return "unknown";
        }
        return email.substring(email.indexOf("@"));
    }

    public List<SentResetEmail> getSentEmails() {
        return Collections.unmodifiableList(new ArrayList<>(sentEmails));
    }

    public SentResetEmail getLastSentEmail() {
        if (sentEmails.isEmpty()) {
            return null;
        }
        return sentEmails.get(sentEmails.size() - 1);
    }

    public void clear() {
        sentEmails.clear();
        shouldFail = false;
    }

    public void setShouldFail(boolean shouldFail) {
        this.shouldFail = shouldFail;
    }

    public record SentResetEmail(
            String toEmail,
            String recipientName,
            String resetToken,
            String resetUrl,
            Instant sentAt
    ) {
    }
}
