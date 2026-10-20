package com.shareloop.dto.request;

import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.enums.ListingRequestStatus;

import java.time.Instant;
import java.util.UUID;

public class ListingRequestResponse {

    private UUID id;
    private ListingReferenceDto listing;
    private RequesterSummaryDto requester;
    private String message;
    private ListingRequestStatus status;
    private Instant createdAt;
    private Instant updatedAt;

    public ListingRequestResponse() {
    }

    public ListingRequestResponse(UUID id, ListingReferenceDto listing, RequesterSummaryDto requester, String message, ListingRequestStatus status, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.listing = listing;
        this.requester = requester;
        this.message = message;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static ListingRequestResponse fromEntity(ListingRequest request) {
        if (request == null) {
            return null;
        }
        return new ListingRequestResponse(
                request.getId(),
                ListingReferenceDto.fromEntity(request.getListing()),
                RequesterSummaryDto.fromEntity(request.getRequester()),
                request.getMessage(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public ListingReferenceDto getListing() {
        return listing;
    }

    public void setListing(ListingReferenceDto listing) {
        this.listing = listing;
    }

    public RequesterSummaryDto getRequester() {
        return requester;
    }

    public void setRequester(RequesterSummaryDto requester) {
        this.requester = requester;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public ListingRequestStatus getStatus() {
        return status;
    }

    public void setStatus(ListingRequestStatus status) {
        this.status = status;
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
}
