package com.shareloop.service.reporting;

import java.util.Locale;

/**
 * Supported time-series bucket sizes. PostgreSQL date_trunc uses ISO weeks,
 * so WEEK buckets always start on Monday.
 */
public enum ReportGranularity {
    DAY,
    WEEK,
    MONTH;

    public String toDateTruncUnit() {
        return name().toLowerCase(Locale.ROOT);
    }
}
