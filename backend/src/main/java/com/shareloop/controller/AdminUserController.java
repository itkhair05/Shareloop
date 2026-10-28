package com.shareloop.controller;

import com.shareloop.dto.user.AdminUserResponse;
import com.shareloop.dto.user.UpdateUserRoleAdminRequest;
import com.shareloop.dto.user.UpdateUserStatusAdminRequest;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Admin Users", description = "Administrative user management, search, and role/status moderation")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @Operation(summary = "List users with optional search, role, status filters, pagination, and sorting (Admin only)")
    @GetMapping
    public ResponseEntity<Page<AdminUserResponse>> getAdminUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<AdminUserResponse> response = adminUserService.getAdminUsers(
                search,
                role,
                status,
                page,
                size,
                sortBy,
                sortDirection,
                principal
        );
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Retrieve administrative user details by ID (Admin only)")
    @GetMapping("/{id}")
    public ResponseEntity<AdminUserResponse> getAdminUserDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminUserResponse response = adminUserService.getAdminUserDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update user account status (Admin only)")
    @PatchMapping("/{id}/status")
    public ResponseEntity<AdminUserResponse> updateUserStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserStatusAdminRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminUserResponse response = adminUserService.updateUserStatus(id, request, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update user role (Admin only)")
    @PatchMapping("/{id}/role")
    public ResponseEntity<AdminUserResponse> updateUserRole(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRoleAdminRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminUserResponse response = adminUserService.updateUserRole(id, request, principal);
        return ResponseEntity.ok(response);
    }
}
