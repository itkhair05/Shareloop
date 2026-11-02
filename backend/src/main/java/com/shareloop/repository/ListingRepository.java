package com.shareloop.repository;

import com.shareloop.dto.category.CategoryListingCountProjection;
import com.shareloop.dto.reporting.projection.CategoryDistributionProjection;
import com.shareloop.dto.reporting.projection.ListingStatusCountProjection;
import com.shareloop.dto.reporting.projection.ListingTypeCountProjection;
import com.shareloop.dto.reporting.projection.ReportBucketCountProjection;
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

import java.time.Instant;
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

    long countByCategoryIdAndStatus(UUID categoryId, ListingStatus status);

    long countByStatus(ListingStatus status);

    @Query("SELECT l.category.id AS categoryId, COUNT(l) AS count " +
            "FROM Listing l " +
            "WHERE l.status = :status " +
            "GROUP BY l.category.id")
    List<CategoryListingCountProjection> countListingsByStatusGroupedByCategory(@Param("status") ListingStatus status);

    @Query("SELECT COUNT(l) FROM Listing l " +
            "WHERE l.createdAt >= :from AND l.createdAt < :to " +
            "AND (:status IS NULL OR l.status = :status) " +
            "AND (:listingType IS NULL OR l.listingType = :listingType) " +
            "AND (:categoryId IS NULL OR l.category.id = :categoryId)")
    long countCreatedInRange(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ListingStatus status,
            @Param("listingType") ListingType listingType,
            @Param("categoryId") UUID categoryId
    );

    @Query("SELECT l.status AS status, COUNT(l) AS count FROM Listing l " +
            "WHERE l.createdAt >= :from AND l.createdAt < :to " +
            "AND (:status IS NULL OR l.status = :status) " +
            "AND (:listingType IS NULL OR l.listingType = :listingType) " +
            "AND (:categoryId IS NULL OR l.category.id = :categoryId) " +
            "GROUP BY l.status")
    List<ListingStatusCountProjection> countCreatedInRangeByStatus(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ListingStatus status,
            @Param("listingType") ListingType listingType,
            @Param("categoryId") UUID categoryId
    );

    @Query("SELECT l.listingType AS listingType, COUNT(l) AS count FROM Listing l " +
            "WHERE l.createdAt >= :from AND l.createdAt < :to " +
            "AND (:status IS NULL OR l.status = :status) " +
            "AND (:listingType IS NULL OR l.listingType = :listingType) " +
            "AND (:categoryId IS NULL OR l.category.id = :categoryId) " +
            "GROUP BY l.listingType")
    List<ListingTypeCountProjection> countCreatedInRangeByListingType(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ListingStatus status,
            @Param("listingType") ListingType listingType,
            @Param("categoryId") UUID categoryId
    );

    @Query("SELECT c.id AS categoryId, c.name AS categoryName, COUNT(l) AS count " +
            "FROM Listing l JOIN l.category c " +
            "WHERE l.createdAt >= :from AND l.createdAt < :to " +
            "AND (:status IS NULL OR l.status = :status) " +
            "AND (:listingType IS NULL OR l.listingType = :listingType) " +
            "AND (:categoryId IS NULL OR c.id = :categoryId) " +
            "GROUP BY c.id, c.name " +
            "ORDER BY c.name ASC, c.id ASC")
    List<CategoryDistributionProjection> countCreatedInRangeByCategory(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ListingStatus status,
            @Param("listingType") ListingType listingType,
            @Param("categoryId") UUID categoryId
    );

    @Query(value = "SELECT CAST(date_trunc(CAST(:granularity AS text), l.created_at AT TIME ZONE CAST(:timezone AS text)) AS date) AS bucket, " +
            "COUNT(*) AS count " +
            "FROM listings l " +
            "WHERE l.created_at >= :fromInstant AND l.created_at < :toInstant " +
            "AND (CAST(:listingType AS text) IS NULL OR l.listing_type = CAST(:listingType AS text)) " +
            "AND (CAST(:categoryId AS uuid) IS NULL OR l.category_id = CAST(:categoryId AS uuid)) " +
            "GROUP BY bucket " +
            "ORDER BY bucket", nativeQuery = true)
    List<ReportBucketCountProjection> countCreatedInRangeByBucket(
            @Param("fromInstant") Instant fromInstant,
            @Param("toInstant") Instant toInstant,
            @Param("granularity") String granularity,
            @Param("timezone") String timezone,
            @Param("listingType") String listingType,
            @Param("categoryId") UUID categoryId
    );
}
