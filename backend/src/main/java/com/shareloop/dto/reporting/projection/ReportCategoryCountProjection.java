package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ReportCategory;

public interface ReportCategoryCountProjection {

    ReportCategory getCategory();

    Long getCount();
}
