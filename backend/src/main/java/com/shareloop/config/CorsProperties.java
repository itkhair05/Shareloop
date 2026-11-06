package com.shareloop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {

    /**
     * Exact origins permitted to call the API (scheme://host[:port]).
     * Wildcards are never valid here.
     */
    private List<String> allowedOrigins = new ArrayList<>();

    /**
     * Origin patterns permitted to call the API, for example
     * "https://*.shareloop.pages.dev" for Cloudflare Pages preview deployments.
     */
    private List<String> allowedOriginPatterns = new ArrayList<>();

    /**
     * Whether browsers may send credentials (cookies) cross-origin. ShareLoop
     * authenticates with Bearer tokens, so this is disabled by default.
     */
    private boolean allowCredentials = false;

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = sanitize(allowedOrigins);
    }

    public List<String> getAllowedOriginPatterns() {
        return allowedOriginPatterns;
    }

    public void setAllowedOriginPatterns(List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = sanitize(allowedOriginPatterns);
    }

    public boolean isAllowCredentials() {
        return allowCredentials;
    }

    public void setAllowCredentials(boolean allowCredentials) {
        this.allowCredentials = allowCredentials;
    }

    private static List<String> sanitize(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        List<String> sanitized = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                sanitized.add(value.trim());
            }
        }
        return sanitized;
    }
}
