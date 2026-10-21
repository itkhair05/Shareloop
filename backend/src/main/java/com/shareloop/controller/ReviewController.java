package com.shareloop.controller;

import com.shareloop.dto.review.*;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ReviewService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Reviews", description = "Participant ratings, reputation feedback, and moderation")
@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /**
     * Authenticated: Submit a review for a completed transaction.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/api/v1/transactions/{transactionId}/reviews")
    public ResponseEntity<ReviewResponse> createReview(
            @PathVariable UUID transactionId,
            @Valid @RequestBody CreateReviewRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ReviewResponse response = reviewService.createReview(transactionId, request, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Authenticated: Retrieve reviews for a transaction (participants or ADMIN).
     */
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/api/v1/transactions/{transactionId}/reviews")
    public ResponseEntity<List<ReviewResponse>> getTransactionReviews(
            @PathVariable UUID transactionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<ReviewResponse> response = reviewService.getTransactionReviews(transactionId, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Public: Retrieve paginated visible reviews for a user.
     */
    @GetMapping("/api/v1/users/{userId}/reviews")
    public ResponseEntity<Page<ReviewResponse>> getUserReviews(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Page<ReviewResponse> response = reviewService.getUserReviews(userId, page, size);
        return ResponseEntity.ok(response);
    }

    /**
     * Public: Retrieve star rating summary and breakdown for a user.
     */
    @GetMapping("/api/v1/users/{userId}/rating-summary")
    public ResponseEntity<UserRatingSummaryResponse> getUserRatingSummary(@PathVariable UUID userId) {
        UserRatingSummaryResponse response = reviewService.getUserRatingSummary(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Soft-moderate (hide) an inappropriate review.
     */
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/api/v1/admin/reviews/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> moderateReview(
            @PathVariable UUID reviewId,
            @Valid @RequestBody ModerateReviewRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        reviewService.moderateReview(reviewId, request, principal);
        return ResponseEntity.noContent().build();
    }
}
