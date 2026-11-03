package com.shareloop.service.reporting.export;

import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.service.reporting.ReportDateRange;
import com.shareloop.service.reporting.ReportGranularity;

import java.util.UUID;

/**
 * Raw export request. Domain status and category values stay as strings
 * because the same query parameter name maps to different enums per section.
 */
public record AdminReportCsvExportRequest(
        AdminReportExportSection section,
        AdminReportExportDataset dataset,
        ReportDateRange range,
        UserRole role,
        ListingType listingType,
        ReportTargetType targetType,
        String status,
        String category,
        UUID categoryId,
        ReportGranularity granularity,
        Integer limit
) {
}
