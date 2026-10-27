package com.shareloop.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpdateProfileRequest {

    @NotBlank(message = "Display name is required")
    @Size(min = 2, max = 100, message = "Display name must be between 2 and 100 characters")
    private String displayName;

    @Pattern(
            regexp = "^$|^0[0-9]{9}$",
            message = "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"
    )
    @Size(max = 30, message = "Phone number must not exceed 30 characters")
    private String phoneNumber;

    public UpdateProfileRequest() {
    }

    public UpdateProfileRequest(String displayName, String phoneNumber) {
        this.displayName = displayName;
        this.phoneNumber = phoneNumber;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
}
