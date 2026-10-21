package com.shareloop.service;

import com.shareloop.dto.review.*;
import com.shareloop.entity.Review;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.DuplicateReviewException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public ReviewService(
            ReviewRepository reviewRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository
    ) {
        this.reviewRepository = reviewRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Submit a review for a completed transaction.
     * 
     * Concurrency & Invariant rules:
     * 1. Acquires row lock on the transaction (findByIdForUpdate).
     * 2. Authenticated user must be a transaction participant (owner or requester).
     * 3. Admins cannot review on behalf of others; only if they are an actual participant.
     * 4. Transaction status must be COMPLETED.
     * 5. Reviewer and reviewee are derived from the locked transaction entity.
     * 6. Duplicate review is rejected with DuplicateReviewException (409 Conflict).
     */
    @Transactional
    public ReviewResponse createReview(UUID transactionId, CreateReviewRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to submit a review");
        }

        Transaction transaction = transactionRepository.findByIdForUpdate(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + transactionId));

        boolean isOwner = transaction.isOwner(principal.getId());
        boolean isRequester = transaction.isRequester(principal.getId());

        if (!isOwner && !isRequester) {
            throw new AccessDeniedException("Only transaction participants can submit a review");
        }

        if (transaction.getStatus() != TransactionStatus.COMPLETED) {
            throw new IllegalArgumentException("Reviews can only be submitted for COMPLETED transactions");
        }

        User reviewer = isOwner ? transaction.getOwner() : transaction.getRequester();
        User reviewee = isOwner ? transaction.getRequester() : transaction.getOwner();

        if (reviewRepository.existsByTransactionIdAndReviewerId(transactionId, reviewer.getId())) {
            throw new DuplicateReviewException("You have already submitted a review for this transaction");
        }

        String comment = request.getComment();
        if (comment != null) {
            comment = comment.trim();
            if (comment.isEmpty()) {
                throw new IllegalArgumentException("Comment must not be blank when provided");
            }
        }

        Review review = new Review(transaction, reviewer, reviewee, request.getRating(), comment);

        try {
            Review saved = reviewRepository.saveAndFlush(review);
            return ReviewResponse.fromEntity(saved);
        } catch (DataIntegrityViolationException ex) {
            if (ex.getMessage() != null && ex.getMessage().contains("uq_reviews_transaction_reviewer")) {
                throw new DuplicateReviewException("You have already submitted a review for this transaction");
            }
            throw ex;
        }
    }

    /**
     * Retrieve reviews for a transaction.
     * Authorized for transaction participants or administrators.
     * Hidden reviews are excluded for non-administrators.
     */
    @Transactional(readOnly = true)
    public List<ReviewResponse> getTransactionReviews(UUID transactionId, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view transaction reviews");
        }

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + transactionId));

        boolean isParticipant = transaction.isParticipant(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;

        if (!isParticipant && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view reviews for this transaction");
        }

        List<Review> reviews = reviewRepository.findByTransactionId(transactionId);
        if (!isAdmin) {
            reviews = reviews.stream()
                    .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                    .toList();
        }

        return reviews.stream()
                .map(ReviewResponse::fromEntity)
                .toList();
    }

    /**
     * Public: Retrieve paginated visible reviews received by a user.
     * Ordered by createdAt DESC with id DESC tie-breaker.
     */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> getUserReviews(UUID userId, int page, int size) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with id: " + userId);
        }

        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 50) {
            throw new IllegalArgumentException("Page size must be between 1 and 50");
        }

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Review> reviews = reviewRepository.findActiveByRevieweeId(userId, pageable);
        return reviews.map(ReviewResponse::fromEntity);
    }

    /**
     * Public: Retrieve aggregate rating summary for a user.
     * Based strictly on visible reviews.
     */
    @Transactional(readOnly = true)
    public UserRatingSummaryResponse getUserRatingSummary(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with id: " + userId);
        }

        long totalReviews = reviewRepository.countActiveByRevieweeId(userId);
        Double averageRating = 0.0;
        if (totalReviews > 0) {
            Double rawAverage = reviewRepository.getAverageRatingByRevieweeId(userId);
            if (rawAverage != null) {
                averageRating = BigDecimal.valueOf(rawAverage).setScale(2, RoundingMode.HALF_UP).doubleValue();
            }
        }

        Map<Integer, Long> starBreakdown = UserRatingSummaryResponse.createDefaultStarBreakdown();
        if (totalReviews > 0) {
            List<RatingCountProjection> distribution = reviewRepository.countRatingsByRevieweeIdGrouped(userId);
            for (RatingCountProjection item : distribution) {
                if (item.getRating() != null && starBreakdown.containsKey(item.getRating())) {
                    starBreakdown.put(item.getRating(), item.getCount());
                }
            }
        }

        return new UserRatingSummaryResponse(userId, averageRating, totalReviews, starBreakdown);
    }

    /**
     * Admin: Soft-moderate (hide) a review.
     * Operation is idempotent; repeated calls for an already hidden review return successfully without error.
     */
    @Transactional
    public void moderateReview(UUID reviewId, ModerateReviewRequest request, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to moderate reviews");
        }

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found with id: " + reviewId));

        if (Boolean.TRUE.equals(review.getIsHidden())) {
            // Idempotent: already hidden, return 204
            return;
        }

        if (request == null || request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new IllegalArgumentException("Moderation reason is required");
        }
        String trimmedReason = request.getReason().trim();
        if (trimmedReason.length() > 500) {
            throw new IllegalArgumentException("Moderation reason must not exceed 500 characters");
        }

        User admin = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found with id: " + principal.getId()));

        review.setIsHidden(true);
        review.setModeratedBy(admin);
        review.setModeratedAt(Instant.now());
        review.setModerationReason(trimmedReason);

        reviewRepository.saveAndFlush(review);
    }
}
