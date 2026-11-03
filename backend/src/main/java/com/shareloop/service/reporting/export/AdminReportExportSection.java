package com.shareloop.service.reporting.export;

public enum AdminReportExportSection {
    OVERVIEW("overview"),
    USERS("users"),
    LISTINGS("listings"),
    TRANSACTIONS("transactions"),
    MODERATION("moderation"),
    REVIEWS("reviews"),
    SUPPORT("support");

    private final String pathValue;

    AdminReportExportSection(String pathValue) {
        this.pathValue = pathValue;
    }

    public String pathValue() {
        return pathValue;
    }

    public static AdminReportExportSection from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Unsupported export section: " + value);
        }
        String normalized = value.trim();
        for (AdminReportExportSection section : values()) {
            if (section.pathValue.equals(normalized)) {
                return section;
            }
        }
        throw new IllegalArgumentException("Unsupported export section: " + value);
    }
}
