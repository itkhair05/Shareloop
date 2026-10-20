package com.shareloop.controller;

import com.shareloop.dto.request.CreateListingRequestDto;
import com.shareloop.dto.request.ListingRequestResponse;
import com.shareloop.dto.request.UpdateListingRequestStatusRequest;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ListingRequestService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class ListingRequestController {

    private final ListingRequestService listingRequestService;

    public ListingRequestController(ListingRequestService listingRequestService) {
        this.listingRequestService = listingRequestService;
    }

    /**
     * Submit a request for an eligible GIVEAWAY or SALE listing.
     */
    @PostMapping("/api/v1/listings/{listingId}/requests")
    public ResponseEntity<ListingRequestResponse> createRequest(
            @PathVariable UUID listingId,
            @Valid @RequestBody(required = false) CreateListingRequestDto dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ListingRequestResponse response = listingRequestService.createRequest(listingId, dto, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Listing owner views requests submitted for their listing.
     */
    @GetMapping("/api/v1/listings/{listingId}/requests")
    public ResponseEntity<Page<ListingRequestResponse>> getRequestsForListing(
            @PathVariable UUID listingId,
            @RequestParam(required = false) ListingRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ListingRequestResponse> response = listingRequestService.getRequestsForListing(listingId, status, page, size, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Authenticated user views their own submitted requests.
     */
    @GetMapping("/api/v1/listing-requests/mine")
    public ResponseEntity<Page<ListingRequestResponse>> getMyRequests(
            @RequestParam(required = false) ListingRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ListingRequestResponse> response = listingRequestService.getMyRequests(status, page, size, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Listing owner accepts or rejects a pending listing request.
     */
    @PatchMapping("/api/v1/listing-requests/{requestId}/status")
    public ResponseEntity<ListingRequestResponse> updateRequestStatus(
            @PathVariable UUID requestId,
            @Valid @RequestBody UpdateListingRequestStatusRequest requestDto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ListingRequestResponse response = listingRequestService.updateRequestStatus(requestId, requestDto, principal);
        return ResponseEntity.ok(response);
    }
}
