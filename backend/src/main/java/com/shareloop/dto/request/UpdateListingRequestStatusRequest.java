package com.shareloop.dto.request;

import com.shareloop.entity.enums.ListingRequestStatus;
import jakarta.validation.constraints.NotNull;

public class UpdateListingRequestStatusRequest {

    @NotNull(message = "Status is required")
    private ListingRequestStatus status;

    public UpdateListingRequestStatusRequest() {
    }

    public UpdateListingRequestStatusRequest(ListingRequestStatus status) {
        this.status = status;
    }

    public ListingRequestStatus getStatus() {
        return status;
    }

    public void setStatus(ListingRequestStatus status) {
        this.status = status;
    }
}
