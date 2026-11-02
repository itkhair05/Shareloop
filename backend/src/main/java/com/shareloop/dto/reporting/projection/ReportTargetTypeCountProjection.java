package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ReportTargetType;

public interface ReportTargetTypeCountProjection {

    ReportTargetType getTargetType();

    Long getCount();
}
