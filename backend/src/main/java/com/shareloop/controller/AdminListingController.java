package com.shareloop.controller;

import com.shareloop.dto.listing.ListingResponse;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ListingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Admin Listings", description = "Administrative overview, filtering, search, and management of item listings")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/listings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminListingController {

    private final ListingService listingService;

    public AdminListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    @Operation(summary = "List all platform listings with optional status, keyword, type, category, owner filters, sorting, and pagination (Admin only)")
    @GetMapping
    public ResponseEntity<Page<ListingResponse>> getAdminListings(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ListingStatus status,
            @RequestParam(required = false) ListingType type,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ListingResponse> response = listingService.getAdminListings(
                keyword,
                status,
                type,
                categoryId,
                ownerId,
                page,
                size,
                sort,
                sortBy,
                sortDirection,
                principal
        );
        return ResponseEntity.ok(response);
    }
}
