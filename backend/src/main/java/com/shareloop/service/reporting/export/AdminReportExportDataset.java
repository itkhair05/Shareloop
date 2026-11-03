package com.shareloop.service.reporting.export;

public enum AdminReportExportDataset {
    SUMMARY("summary"),
    TIMESERIES("timeseries"),
    TOP_REQUESTED("top-requested");

    private final String wireValue;

    AdminReportExportDataset(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static AdminReportExportDataset from(String value) {
        if (value == null) {
            return SUMMARY;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Unsupported export dataset: " + value);
        }
        for (AdminReportExportDataset dataset : values()) {
            if (dataset.wireValue.equals(normalized)) {
                return dataset;
            }
        }
        throw new IllegalArgumentException("Unsupported export dataset: " + value);
    }
}
