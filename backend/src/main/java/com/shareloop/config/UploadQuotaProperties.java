package com.shareloop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Rolling per-user upload quota. Enforcement is database-backed so it remains
 * correct when several application instances accept uploads concurrently.
 */
@Component
@ConfigurationProperties(prefix = "app.uploads.quota")
public class UploadQuotaProperties {

    /**
     * Enables the rolling per-user byte quota.
     */
    private boolean enabled = true;

    /**
     * Maximum bytes a single user may register within the rolling window.
     */
    private long userPeriodBytes = 50L * 1024 * 1024;

    /**
     * Rolling window length in hours.
     */
    private int userPeriodHours = 24;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getUserPeriodBytes() {
        return userPeriodBytes;
    }

    public void setUserPeriodBytes(long userPeriodBytes) {
        this.userPeriodBytes = userPeriodBytes;
    }

    public int getUserPeriodHours() {
        return userPeriodHours;
    }

    public void setUserPeriodHours(int userPeriodHours) {
        this.userPeriodHours = userPeriodHours;
    }
}
