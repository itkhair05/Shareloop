package com.shareloop.security.google;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Google OAuth 2.0 / Identity Services authentication.
 *
 * Defaults to disabled (enabled = false) so existing deployments and local/test environments
 * start seamlessly without requiring Google credentials.
 */
@Component
@ConfigurationProperties(prefix = "app.security.google")
public class GoogleSecurityProperties {

    /**
     * Whether Google Sign-In is enabled.
     * Default is false.
     */
    private boolean enabled = false;

    /**
     * Google OAuth 2.0 Client ID (e.g., 123456789-abc.apps.googleusercontent.com).
     */
    private String clientId = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId != null ? clientId.trim() : "";
    }
}
