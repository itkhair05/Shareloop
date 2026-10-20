package com.shareloop.dto.request;

import jakarta.validation.constraints.Size;

public class CreateListingRequestDto {

    @Size(max = 1000, message = "Message must not exceed 1000 characters")
    private String message;

    public CreateListingRequestDto() {
    }

    public CreateListingRequestDto(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
