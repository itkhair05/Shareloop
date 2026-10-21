package com.shareloop.dto.category;

import jakarta.validation.constraints.NotNull;

public class UpdateCategoryStatusRequest {

    @NotNull(message = "isActive is required")
    private Boolean isActive;

    public UpdateCategoryStatusRequest() {
    }

    public UpdateCategoryStatusRequest(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
}
