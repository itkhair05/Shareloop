package com.shareloop.dto.review;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ModerateReviewRequest {

    @NotBlank(message = "Moderation reason is required")
    @Size(max = 500, message = "Moderation reason must not exceed 500 characters")
    private String reason;

    public ModerateReviewRequest() {
    }

    public ModerateReviewRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
