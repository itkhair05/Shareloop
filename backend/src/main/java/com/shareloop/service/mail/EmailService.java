package com.shareloop.service.mail;

public interface EmailService {

    /**
     * Sends a password reset email with the raw reset token and token lifetime.
     *
     * @param toEmail           recipient email address
     * @param recipientName     recipient display name
     * @param resetToken        raw random token to be included in the reset link
     * @param expirationMinutes token lifetime in minutes
     */
    void sendPasswordResetEmail(String toEmail, String recipientName, String resetToken, int expirationMinutes);

    /**
     * Default overload with 15 minutes lifetime.
     */
    default void sendPasswordResetEmail(String toEmail, String recipientName, String resetToken) {
        sendPasswordResetEmail(toEmail, recipientName, resetToken, 15);
    }
}
