package com.shareloop.dto.user;

import com.shareloop.entity.enums.UserStatus;
import jakarta.validation.constraints.NotNull;

public class UpdateUserStatusAdminRequest {

    @NotNull(message = "Trạng thái người dùng không được để trống")
    private UserStatus status;

    public UpdateUserStatusAdminRequest() {
    }

    public UpdateUserStatusAdminRequest(UserStatus status) {
        this.status = status;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }
}
