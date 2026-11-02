package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ReportStatus;

public interface ReportStatusCountProjection {

    ReportStatus getStatus();

    Long getCount();
}
