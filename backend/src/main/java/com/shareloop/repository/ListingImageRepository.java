package com.shareloop.repository;

import com.shareloop.entity.ListingImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ListingImageRepository extends JpaRepository<ListingImage, UUID> {

    List<ListingImage> findByListingIdOrderBySortOrderAsc(UUID listingId);

    /**
     * Counts listing images whose stored URL points at the given managed filename.
     * Listing images are stored as URLs (relative backend proxy paths or absolute
     * legacy URLs), so the match accepts either an exact filename or a trailing
     * path segment.
     */
    @Query("SELECT COUNT(li) FROM ListingImage li " +
           "WHERE li.imageUrl = :filename " +
           "   OR li.imageUrl LIKE CONCAT('%/', :filename)")
    long countReferencesToFilename(@Param("filename") String filename);
}
