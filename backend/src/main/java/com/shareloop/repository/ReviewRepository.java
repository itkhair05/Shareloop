package com.shareloop.repository;

import com.shareloop.dto.review.RatingCountProjection;
import com.shareloop.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID>, JpaSpecificationExecutor<Review> {

    /**
     * Existence check for duplicate prevention per transaction per reviewer.
     */
    boolean existsByTransactionIdAndReviewerId(UUID transactionId, UUID reviewerId);

    /**
     * Lookup review by transaction and reviewer.
     */
    Optional<Review> findByTransactionIdAndReviewerId(UUID transactionId, UUID reviewerId);

    /**
     * Fetch all reviews for a transaction with reviewer, reviewee, and transaction details.
     */
    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.transaction t " +
            "JOIN FETCH t.listing l " +
            "JOIN FETCH l.owner lo " +
            "JOIN FETCH r.reviewer u1 " +
            "JOIN FETCH r.reviewee u2 " +
            "LEFT JOIN FETCH r.moderatedBy mb " +
            "WHERE r.transaction.id = :transactionId " +
            "ORDER BY r.createdAt ASC")
    List<Review> findByTransactionId(@Param("transactionId") UUID transactionId);

    /**
     * Paginated public reviews received by a user (reviewee), excluding hidden/moderated reviews.
     */
    @Query(value = "SELECT r FROM Review r " +
            "JOIN FETCH r.reviewer u1 " +
            "JOIN FETCH r.reviewee u2 " +
            "JOIN FETCH r.transaction t " +
            "JOIN FETCH t.listing l " +
            "JOIN FETCH l.owner lo " +
            "WHERE r.reviewee.id = :revieweeId AND r.isHidden = false",
            countQuery = "SELECT count(r) FROM Review r WHERE r.reviewee.id = :revieweeId AND r.isHidden = false")
    Page<Review> findActiveByRevieweeId(@Param("revieweeId") UUID revieweeId, Pageable pageable);

    /**
     * Aggregated star count distribution for a user (excluding hidden reviews).
     * Grouped by rating (1 through 5).
     */
    @Query("SELECT r.rating AS rating, COUNT(r) AS count " +
            "FROM Review r " +
            "WHERE r.reviewee.id = :revieweeId AND r.isHidden = false " +
            "GROUP BY r.rating")
    List<RatingCountProjection> countRatingsByRevieweeIdGrouped(@Param("revieweeId") UUID revieweeId);

    /**
     * Total review count and average rating calculation projection for a user (excluding hidden reviews).
     */
    @Query("SELECT COUNT(r) FROM Review r WHERE r.reviewee.id = :revieweeId AND r.isHidden = false")
    long countActiveByRevieweeId(@Param("revieweeId") UUID revieweeId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.reviewee.id = :revieweeId AND r.isHidden = false")
    Double getAverageRatingByRevieweeId(@Param("revieweeId") UUID revieweeId);

    /**
     * Fetch single review with details for Admin moderation or inspection.
     */
    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.transaction t " +
            "JOIN FETCH t.listing l " +
            "JOIN FETCH l.owner lo " +
            "JOIN FETCH r.reviewer u1 " +
            "JOIN FETCH r.reviewee u2 " +
            "LEFT JOIN FETCH r.moderatedBy mb " +
            "WHERE r.id = :id")
    Optional<Review> findWithDetailsById(@Param("id") UUID id);
}
