package com.shareloop.dto.reporting.projection;

import java.util.UUID;

public interface CategoryDistributionProjection {

    UUID getCategoryId();

    String getCategoryName();

    Long getCount();
}
