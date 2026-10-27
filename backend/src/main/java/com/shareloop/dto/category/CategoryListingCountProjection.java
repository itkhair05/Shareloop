package com.shareloop.dto.category;

import java.util.UUID;

/**
 * Projection interface for aggregated active listing counts grouped by category ID.
 * Used by Admin Categories API to prevent N+1 query patterns.
 */
public interface CategoryListingCountProjection {

    UUID getCategoryId();

    Long getCount();
}
