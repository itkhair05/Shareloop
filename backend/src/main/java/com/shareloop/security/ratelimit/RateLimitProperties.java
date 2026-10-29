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
}
