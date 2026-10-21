package com.shareloop.dto.review;

import com.shareloop.dto.chat.UserSummaryDto;
import com.shareloop.dto.request.ListingReferenceDto;
import com.shareloop.entity.Review;

import java.time.Instant;
import java.util.UUID;

public class ReviewResponse {

    private UUID id;
    private UUID transactionId;
    private ListingReferenceDto listing;
    private UserSummaryDto reviewer;
    private UserSummaryDto reviewee;
    private Integer rating;
    private String comment;
    private Instant createdAt;

    public ReviewResponse() {
    }

    public ReviewResponse(
            UUID id,
            UUID transactionId,
            ListingReferenceDto listing,
            UserSummaryDto reviewer,
            UserSummaryDto reviewee,
            Integer rating,
            String comment,
            Instant createdAt
    ) {
        this.id = id;
        this.transactionId = transactionId;
        this.listing = listing;
        this.reviewer = reviewer;
        this.reviewee = reviewee;
        this.rating = rating;
        this.comment = comment;
        this.createdAt = createdAt;
    }

    public static ReviewResponse fromEntity(Review review) {
        if (review == null) {
            return null;
        }

        ListingReferenceDto listingDto = null;
        UUID txId = null;
        if (review.getTransaction() != null) {
            txId = review.getTransaction().getId();
            if (review.getTransaction().getListing() != null) {
                listingDto = ListingReferenceDto.fromEntity(review.getTransaction().getListing());
            }
        }

        return new ReviewResponse(
                review.getId(),
                txId,
                listingDto,
                UserSummaryDto.fromEntity(review.getReviewer()),
                UserSummaryDto.fromEntity(review.getReviewee()),
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(UUID transactionId) {
        this.transactionId = transactionId;
    }

    public ListingReferenceDto getListing() {
        return listing;
    }

    public void setListing(ListingReferenceDto listing) {
        this.listing = listing;
    }

    public UserSummaryDto getReviewer() {
        return reviewer;
    }

    public void setReviewer(UserSummaryDto reviewer) {
        this.reviewer = reviewer;
    }

    public UserSummaryDto getReviewee() {
        return reviewee;
    }

    public void setReviewee(UserSummaryDto reviewee) {
        this.reviewee = reviewee;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
