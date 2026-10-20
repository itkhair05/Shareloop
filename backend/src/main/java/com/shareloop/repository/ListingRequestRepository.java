package com.shareloop.repository;

import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.enums.ListingRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ListingRequestRepository extends JpaRepository<ListingRequest, UUID> {

    List<ListingRequest> findByListingId(UUID listingId);

    List<ListingRequest> findByRequesterId(UUID requesterId);

    Optional<ListingRequest> findByListingIdAndRequesterIdAndStatus(UUID listingId, UUID requesterId, ListingRequestStatus status);

    boolean existsByListingIdAndRequesterIdAndStatus(UUID listingId, UUID requesterId, ListingRequestStatus status);

    boolean existsByListingId(UUID listingId);
}
