package com.shareloop.repository;

import com.shareloop.entity.ReviewImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewImageRepository extends JpaRepository<ReviewImage, UUID> {

    List<ReviewImage> findByReviewIdOrderByDisplayOrderAsc(UUID reviewId);

    @Query("SELECT i FROM ReviewImage i " +
            "WHERE i.review.id IN :reviewIds " +
            "ORDER BY i.review.id ASC, i.displayOrder ASC")
    List<ReviewImage> findByReviewIdsOrderByDisplayOrderAsc(@Param("reviewIds") Collection<UUID> reviewIds);

    Optional<ReviewImage> findByFileId(UUID fileId);
}
