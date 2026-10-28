package com.shareloop.dto.user;

import com.shareloop.entity.enums.UserRole;
import jakarta.validation.constraints.NotNull;

public class UpdateUserRoleAdminRequest {

    @NotNull(message = "Vai trò người dùng không được để trống")
    private UserRole role;

    public UpdateUserRoleAdminRequest() {
    }

    public UpdateUserRoleAdminRequest(UserRole role) {
        this.role = role;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }
}
