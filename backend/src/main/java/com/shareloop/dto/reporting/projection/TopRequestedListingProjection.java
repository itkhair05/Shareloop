package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.ListingType;

import java.util.UUID;

public interface TopRequestedListingProjection {

    UUID getListingId();

    String getTitle();

    UUID getOwnerId();

    String getOwnerDisplayName();

    UUID getCategoryId();

    String getCategoryName();

    ListingType getListingType();

    Long getRequestCount();
}
