package com.shareloop.repository;

import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ListingRepository extends JpaRepository<Listing, UUID> {

    List<Listing> findByOwnerId(UUID ownerId);

    List<Listing> findByOwnerIdAndStatus(UUID ownerId, ListingStatus status);

    List<Listing> findByCategoryIdAndStatus(UUID categoryId, ListingStatus status);

    List<Listing> findByListingTypeAndStatus(ListingType listingType, ListingStatus status);

    List<Listing> findByCityIgnoreCaseAndStatus(String city, ListingStatus status);
}
