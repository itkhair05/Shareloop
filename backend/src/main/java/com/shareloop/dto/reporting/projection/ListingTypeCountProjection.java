package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ListingType;

public interface ListingTypeCountProjection {

    ListingType getListingType();

    Long getCount();
}
