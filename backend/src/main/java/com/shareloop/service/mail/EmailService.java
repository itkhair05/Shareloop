package com.shareloop.service.mail;

public interface EmailService {

    /**
     * Sends a password reset email with the raw reset token.
     *
     * @param toEmail       recipient email address
     * @param recipientName recipient display name
     * @param resetToken    raw random token to be included in the reset link
     */
    void sendPasswordResetEmail(String toEmail, String recipientName, String resetToken);
}
