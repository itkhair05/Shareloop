package com.shareloop.security.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.security.rate-limit")
public class RateLimitProperties {

    /**
     * List of trusted proxy IP addresses or CIDR blocks (e.g. "127.0.0.1", "10.0.0.0/8").
     * When empty, X-Forwarded-For headers are never trusted.
     */
    private List<String> trustedProxies = new ArrayList<>();

    /**
     * Maximum login requests allowed per IP within the rolling window.
     */
    private int loginLimit = 5;

    /**
     * Duration in seconds of the login rolling window (default: 60 seconds).
     */
    private int loginWindowSeconds = 60;

    /**
     * Retention period in hours for login attempts before automated cleanup (default: 24 hours).
     */
    private int loginAttemptRetentionHours = 24;

    public List<String> getTrustedProxies() {
        return trustedProxies;
    }

    public void setTrustedProxies(List<String> trustedProxies) {
        this.trustedProxies = trustedProxies != null ? trustedProxies : new ArrayList<>();
    }

    public int getLoginLimit() {
        return loginLimit;
    }

    public void setLoginLimit(int loginLimit) {
        this.loginLimit = loginLimit;
    }

    public int getLoginWindowSeconds() {
        return loginWindowSeconds;
    }

    public void setLoginWindowSeconds(int loginWindowSeconds) {
        this.loginWindowSeconds = loginWindowSeconds;
    }

    public int getLoginAttemptRetentionHours() {
        return loginAttemptRetentionHours;
    }

    public void setLoginAttemptRetentionHours(int loginAttemptRetentionHours) {
        this.loginAttemptRetentionHours = loginAttemptRetentionHours;
    }

    /**
     * Maximum chat message-send attempts allowed per user within the rolling window.
     */
    private int chatMessageLimit = 20;

    /**
     * Duration in seconds of the chat message rolling window (default: 60 seconds).
     */
    private int chatWindowSeconds = 60;

    public int getChatMessageLimit() {
        return chatMessageLimit;
    }

    public void setChatMessageLimit(int chatMessageLimit) {
        this.chatMessageLimit = chatMessageLimit;
    }

    public int getChatWindowSeconds() {
        return chatWindowSeconds;
    }

    public void setChatWindowSeconds(int chatWindowSeconds) {
        this.chatWindowSeconds = chatWindowSeconds;
    }

    public int getChatLimit() {
        return chatMessageLimit;
    }

    public void setChatLimit(int chatLimit) {
        this.chatMessageLimit = chatLimit;
    }

    /**
     * Maximum forgot password requests allowed per IP within the rolling window.
     */
    private int forgotPasswordIpLimit = 5;

    /**
     * Maximum forgot password requests allowed per normalized email within the rolling window.
     */
    private int forgotPasswordEmailLimit = 3;

    /**
     * Duration in seconds of the forgot password rolling window (default: 900 seconds / 15 minutes).
     */
    private int forgotPasswordWindowSeconds = 900;

    /**
     * Secret key for keyed HMAC-SHA256 hashing of emails in forgot password attempts.
     */
    private String forgotPasswordSecret = "shareloop-forgot-password-salt-key-default";

    /**
     * Expiration duration in minutes for password reset tokens (default: 15 minutes).
     */
    private int resetTokenExpirationMinutes = 15;

    public int getForgotPasswordIpLimit() {
        return forgotPasswordIpLimit;
    }

    public void setForgotPasswordIpLimit(int forgotPasswordIpLimit) {
        this.forgotPasswordIpLimit = forgotPasswordIpLimit;
    }

    public int getForgotPasswordEmailLimit() {
        return forgotPasswordEmailLimit;
    }

    public void setForgotPasswordEmailLimit(int forgotPasswordEmailLimit) {
        this.forgotPasswordEmailLimit = forgotPasswordEmailLimit;
    }

    public int getForgotPasswordWindowSeconds() {
        return forgotPasswordWindowSeconds;
    }

    public void setForgotPasswordWindowSeconds(int forgotPasswordWindowSeconds) {
        this.forgotPasswordWindowSeconds = forgotPasswordWindowSeconds;
    }

    public String getForgotPasswordSecret() {
        return forgotPasswordSecret;
    }

    public void setForgotPasswordSecret(String forgotPasswordSecret) {
        this.forgotPasswordSecret = forgotPasswordSecret;
    }

    public int getResetTokenExpirationMinutes() {
        return resetTokenExpirationMinutes;
    }

    public void setResetTokenExpirationMinutes(int resetTokenExpirationMinutes) {
        this.resetTokenExpirationMinutes = resetTokenExpirationMinutes;
    }

    /**
     * Retention period in hours for forgot-password attempt audit records (default: 24 hours).
     */
    private int forgotPasswordAttemptRetentionHours = 24;

    /**
     * Retention period in days for expired or consumed password reset tokens (default: 7 days).
     */
    private int passwordResetTokenRetentionDays = 7;

    /**
     * Cron expression for scheduled cleanup of password reset tokens and forgot password attempts.
     */
    private String passwordResetCleanupCron = "0 0 * * * *";

    public int getForgotPasswordAttemptRetentionHours() {
        return forgotPasswordAttemptRetentionHours;
    }

    public void setForgotPasswordAttemptRetentionHours(int forgotPasswordAttemptRetentionHours) {
        this.forgotPasswordAttemptRetentionHours = forgotPasswordAttemptRetentionHours;
    }

    public int getPasswordResetTokenRetentionDays() {
        return passwordResetTokenRetentionDays;
    }

    public void setPasswordResetTokenRetentionDays(int passwordResetTokenRetentionDays) {
        this.passwordResetTokenRetentionDays = passwordResetTokenRetentionDays;
    }

    public String getPasswordResetCleanupCron() {
        return passwordResetCleanupCron;
    }

    public void setPasswordResetCleanupCron(String passwordResetCleanupCron) {
        this.passwordResetCleanupCron = passwordResetCleanupCron;
    }

    /**
     * Maximum change-password attempts allowed per user within the rolling window.
     */
    private int changePasswordUserLimit = 5;

    /**
     * Maximum change-password attempts allowed per IP within the rolling window.
     */
    private int changePasswordIpLimit = 10;

    /**
     * Duration in seconds of the change-password rolling window (default: 60 seconds).
     */
    private int changePasswordWindowSeconds = 60;

    /**
     * Maximum set-password attempts allowed per user within the rolling window.
     */
    private int setPasswordUserLimit = 5;

    /**
     * Maximum set-password attempts allowed per IP within the rolling window.
     */
    private int setPasswordIpLimit = 10;

    /**
     * Duration in seconds of the set-password rolling window (default: 60 seconds).
     */
    private int setPasswordWindowSeconds = 60;

    public int getChangePasswordUserLimit() {
        return changePasswordUserLimit;
    }

    public void setChangePasswordUserLimit(int changePasswordUserLimit) {
        this.changePasswordUserLimit = changePasswordUserLimit;
    }

    public int getChangePasswordIpLimit() {
        return changePasswordIpLimit;
    }

    public void setChangePasswordIpLimit(int changePasswordIpLimit) {
        this.changePasswordIpLimit = changePasswordIpLimit;
    }

    public int getChangePasswordWindowSeconds() {
        return changePasswordWindowSeconds;
    }

    public void setChangePasswordWindowSeconds(int changePasswordWindowSeconds) {
        this.changePasswordWindowSeconds = changePasswordWindowSeconds;
    }

    public int getSetPasswordUserLimit() {
        return setPasswordUserLimit;
    }

    public void setSetPasswordUserLimit(int setPasswordUserLimit) {
        this.setPasswordUserLimit = setPasswordUserLimit;
    }

    public int getSetPasswordIpLimit() {
        return setPasswordIpLimit;
    }

    public void setSetPasswordIpLimit(int setPasswordIpLimit) {
        this.setPasswordIpLimit = setPasswordIpLimit;
    }

    public int getSetPasswordWindowSeconds() {
        return setPasswordWindowSeconds;
    }

    public void setSetPasswordWindowSeconds(int setPasswordWindowSeconds) {
        this.setPasswordWindowSeconds = setPasswordWindowSeconds;
    }
}

