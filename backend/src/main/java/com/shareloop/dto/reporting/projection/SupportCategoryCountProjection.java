package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.SupportCategory;

public interface SupportCategoryCountProjection {

    SupportCategory getCategory();

    Long getCount();
}
