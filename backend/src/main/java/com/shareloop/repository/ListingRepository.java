package com.shareloop.repository;

import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ListingRepository extends JpaRepository<Listing, UUID>, JpaSpecificationExecutor<Listing> {

    @Override
    @EntityGraph(attributePaths = {"owner", "category"})
    Page<Listing> findAll(Specification<Listing> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"owner", "category"})
    Optional<Listing> findWithDetailsById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Listing l WHERE l.id = :id")
    Optional<Listing> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"owner", "category"})
    Page<Listing> findByOwnerId(UUID ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"owner", "category"})
    Page<Listing> findByOwnerIdAndStatus(UUID ownerId, ListingStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"owner", "category"})
    Page<Listing> findByStatus(ListingStatus status, Pageable pageable);

    List<Listing> findByOwnerId(UUID ownerId);

    List<Listing> findByOwnerIdAndStatus(UUID ownerId, ListingStatus status);

    List<Listing> findByCategoryIdAndStatus(UUID categoryId, ListingStatus status);

    List<Listing> findByListingTypeAndStatus(ListingType listingType, ListingStatus status);

    List<Listing> findByCityIgnoreCaseAndStatus(String city, ListingStatus status);
}
