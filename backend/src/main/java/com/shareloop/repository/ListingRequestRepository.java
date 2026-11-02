package com.shareloop.repository;

import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.enums.ListingRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ListingRequestRepository extends JpaRepository<ListingRequest, UUID> {

    @EntityGraph(attributePaths = {"requester", "listing", "listing.owner"})
    Page<ListingRequest> findByListingId(UUID listingId, Pageable pageable);

    @EntityGraph(attributePaths = {"requester", "listing", "listing.owner"})
    Page<ListingRequest> findByListingIdAndStatus(UUID listingId, ListingRequestStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"requester", "listing", "listing.owner"})
    Page<ListingRequest> findByRequesterId(UUID requesterId, Pageable pageable);

    @EntityGraph(attributePaths = {"requester", "listing", "listing.owner"})
    Page<ListingRequest> findByRequesterIdAndStatus(UUID requesterId, ListingRequestStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"requester", "listing", "listing.owner"})
    Optional<ListingRequest> findWithDetailsById(UUID id);

    List<ListingRequest> findByListingId(UUID listingId);

    List<ListingRequest> findByRequesterId(UUID requesterId);

    Optional<ListingRequest> findByListingIdAndRequesterIdAndStatus(UUID listingId, UUID requesterId, ListingRequestStatus status);

    boolean existsByListingIdAndRequesterIdAndStatus(UUID listingId, UUID requesterId, ListingRequestStatus status);

    boolean existsByListingId(UUID listingId);

    @Query("select count(r) from ListingRequest r where r.listing.id = :listingId and r.status in :statuses")
    long countByListingIdAndStatusIn(
            @Param("listingId") UUID listingId,
            @Param("statuses") Collection<ListingRequestStatus> statuses
    );
}
