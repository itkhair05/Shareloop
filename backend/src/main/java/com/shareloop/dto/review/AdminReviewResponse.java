package com.shareloop.dto.review;

import com.shareloop.entity.Review;
import com.shareloop.entity.enums.TransactionStatus;

import java.time.Instant;
import java.util.UUID;

public class AdminReviewResponse {

    private UUID id;
    private Integer rating;
    private String comment;
    private Instant createdAt;
    private Instant updatedAt;
    private Boolean isHidden;

    // Reviewer details
    private UUID reviewerId;
    private String reviewerDisplayName;
    private String reviewerEmail;
    private String reviewerAvatarUrl;

    // Reviewee details
    private UUID revieweeId;
    private String revieweeDisplayName;
    private String revieweeEmail;
    private String revieweeAvatarUrl;

    // Transaction details
    private UUID transactionId;
    private TransactionStatus transactionStatus;

    // Moderation details
    private UUID moderatedById;
    private String moderatedByDisplayName;
    private Instant moderatedAt;
    private String moderationReason;

    public AdminReviewResponse() {
    }

    public static AdminReviewResponse fromEntity(Review review) {
        if (review == null) {
            return null;
        }

        AdminReviewResponse response = new AdminReviewResponse();
        response.setId(review.getId());
        response.setRating(review.getRating());
        response.setComment(review.getComment());
        response.setCreatedAt(review.getCreatedAt());
        response.setUpdatedAt(review.getUpdatedAt());
        response.setIsHidden(review.getIsHidden());

        if (review.getReviewer() != null) {
            response.setReviewerId(review.getReviewer().getId());
            response.setReviewerDisplayName(review.getReviewer().getDisplayName());
            response.setReviewerEmail(review.getReviewer().getEmail());
            response.setReviewerAvatarUrl(review.getReviewer().getEffectiveAvatarUrl());
        }

        if (review.getReviewee() != null) {
            response.setRevieweeId(review.getReviewee().getId());
            response.setRevieweeDisplayName(review.getReviewee().getDisplayName());
            response.setRevieweeEmail(review.getReviewee().getEmail());
            response.setRevieweeAvatarUrl(review.getReviewee().getEffectiveAvatarUrl());
        }

        if (review.getTransaction() != null) {
            response.setTransactionId(review.getTransaction().getId());
            response.setTransactionStatus(review.getTransaction().getStatus());
        }

        if (review.getModeratedBy() != null) {
            response.setModeratedById(review.getModeratedBy().getId());
            response.setModeratedByDisplayName(review.getModeratedBy().getDisplayName());
        }
        response.setModeratedAt(review.getModeratedAt());
        response.setModerationReason(review.getModerationReason());

        return response;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getIsHidden() {
        return isHidden;
    }

    public void setIsHidden(Boolean isHidden) {
        this.isHidden = isHidden;
    }

    public UUID getReviewerId() {
        return reviewerId;
    }

    public void setReviewerId(UUID reviewerId) {
        this.reviewerId = reviewerId;
    }

    public String getReviewerDisplayName() {
        return reviewerDisplayName;
    }

    public void setReviewerDisplayName(String reviewerDisplayName) {
        this.reviewerDisplayName = reviewerDisplayName;
    }

    public String getReviewerEmail() {
        return reviewerEmail;
    }

    public void setReviewerEmail(String reviewerEmail) {
        this.reviewerEmail = reviewerEmail;
    }

    public UUID getRevieweeId() {
        return revieweeId;
    }

    public void setRevieweeId(UUID revieweeId) {
        this.revieweeId = revieweeId;
    }

    public String getRevieweeDisplayName() {
        return revieweeDisplayName;
    }

    public void setRevieweeDisplayName(String revieweeDisplayName) {
        this.revieweeDisplayName = revieweeDisplayName;
    }

    public String getReviewerAvatarUrl() {
        return reviewerAvatarUrl;
    }

    public void setReviewerAvatarUrl(String reviewerAvatarUrl) {
        this.reviewerAvatarUrl = reviewerAvatarUrl;
    }

    public String getRevieweeEmail() {
        return revieweeEmail;
    }

    public void setRevieweeEmail(String revieweeEmail) {
        this.revieweeEmail = revieweeEmail;
    }

    public String getRevieweeAvatarUrl() {
        return revieweeAvatarUrl;
    }

    public void setRevieweeAvatarUrl(String revieweeAvatarUrl) {
        this.revieweeAvatarUrl = revieweeAvatarUrl;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(UUID transactionId) {
        this.transactionId = transactionId;
    }

    public TransactionStatus getTransactionStatus() {
        return transactionStatus;
    }

    public void setTransactionStatus(TransactionStatus transactionStatus) {
        this.transactionStatus = transactionStatus;
    }

    public UUID getModeratedById() {
        return moderatedById;
    }

    public void setModeratedById(UUID moderatedById) {
        this.moderatedById = moderatedById;
    }

    public String getModeratedByDisplayName() {
        return moderatedByDisplayName;
    }

    public void setModeratedByDisplayName(String moderatedByDisplayName) {
        this.moderatedByDisplayName = moderatedByDisplayName;
    }

    public Instant getModeratedAt() {
        return moderatedAt;
    }

    public void setModeratedAt(Instant moderatedAt) {
        this.moderatedAt = moderatedAt;
    }

    public String getModerationReason() {
        return moderationReason;
    }

    public void setModerationReason(String moderationReason) {
        this.moderationReason = moderationReason;
    }
}
