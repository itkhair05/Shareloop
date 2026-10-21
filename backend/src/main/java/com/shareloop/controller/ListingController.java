package com.shareloop.controller;

import com.shareloop.dto.listing.CreateListingRequest;
import com.shareloop.dto.listing.ListingResponse;
import com.shareloop.dto.listing.ListingSummaryResponse;
import com.shareloop.dto.listing.UpdateListingRequest;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ListingService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Listings", description = "Item listings creation, retrieval, updates, status transitions, and images")
@RestController
@RequestMapping("/api/v1/listings")
public class ListingController {

    private final ListingService listingService;

    public ListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    /**
     * Browse active, publicly visible listings.
     * Supports pagination, keyword search, type, categoryId, and city filters.
     */
    @GetMapping
    public ResponseEntity<Page<ListingSummaryResponse>> getPublicListings(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ListingType type,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) ListingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<ListingSummaryResponse> listings = listingService.getPublicListings(
                keyword,
                type,
                categoryId,
                city,
                status,
                page,
                size
        );
        return ResponseEntity.ok(listings);
    }

    /**
     * Get the authenticated user's own listings.
     * Must be declared before /{id} to ensure proper routing.
     */
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine")
    public ResponseEntity<Page<ListingSummaryResponse>> getMyListings(
            @RequestParam(required = false) ListingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ListingSummaryResponse> listings = listingService.getMyListings(
                status,
                page,
                size,
                principal
        );
        return ResponseEntity.ok(listings);
    }

    /**
     * Retrieve public listing details by ID.
     * Returns 404 for non-existent or non-public listings (unless requester is owner/admin).
     */
    @GetMapping("/{id}")
    public ResponseEntity<ListingResponse> getListingById(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ListingResponse listing = listingService.getPublicListingById(id, principal);
        return ResponseEntity.ok(listing);
    }

    /**
     * Create a new listing owned by the authenticated user.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<ListingResponse> createListing(
            @Valid @RequestBody CreateListingRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ListingResponse created = listingService.createListing(request, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Update an existing listing. Only the owner (or ADMIN) may edit.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{id}")
    public ResponseEntity<ListingResponse> updateListing(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateListingRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ListingResponse updated = listingService.updateListing(id, request, principal);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete an existing listing. Only the owner (or ADMIN) may delete.
     * Uses status-based safe removal (REMOVED) if transactions exist to preserve referential integrity.
     */
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteListing(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        listingService.deleteListing(id, principal);
        return ResponseEntity.noContent().build();
    }
}
