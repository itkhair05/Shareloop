package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ListingStatus;

public interface ListingStatusCountProjection {

    ListingStatus getStatus();

    Long getCount();
}
