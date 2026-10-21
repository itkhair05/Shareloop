package com.shareloop.dto.transaction;

import jakarta.validation.constraints.Size;

public class CancelTransactionRequest {

    @Size(max = 500, message = "Cancellation reason must not exceed 500 characters")
    private String reason;

    public CancelTransactionRequest() {
    }

    public CancelTransactionRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
