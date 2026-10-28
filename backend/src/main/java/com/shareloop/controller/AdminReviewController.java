package com.shareloop.controller;

import com.shareloop.dto.review.AdminReviewResponse;
import com.shareloop.dto.review.ModerateReviewRequest;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Admin Reviews", description = "Administrative review management, inspection, moderation, and restoration")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/reviews")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {

    private final ReviewService reviewService;

    public AdminReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @Operation(summary = "List reviews with optional isHidden and rating filters, search, pagination, and sorting (Admin only)")
    @GetMapping
    public ResponseEntity<Page<AdminReviewResponse>> getAdminReviews(
            @RequestParam(required = false) Boolean isHidden,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<AdminReviewResponse> response = reviewService.getAdminReviews(
                isHidden,
                rating,
                search,
                page,
                size,
                sortBy,
                sortDirection,
                principal
        );
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Retrieve administrative review details by ID (Admin only)")
    @GetMapping("/{reviewId}")
    public ResponseEntity<AdminReviewResponse> getAdminReviewDetails(
            @PathVariable UUID reviewId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminReviewResponse response = reviewService.getAdminReviewDetails(reviewId, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Restore a previously hidden review (Admin only)")
    @PostMapping("/{reviewId}/restore")
    public ResponseEntity<AdminReviewResponse> restoreReview(
            @PathVariable UUID reviewId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminReviewResponse response = reviewService.restoreReview(reviewId, principal);
        return ResponseEntity.ok(response);
    }
}
