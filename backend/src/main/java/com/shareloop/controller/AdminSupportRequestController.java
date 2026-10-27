package com.shareloop.controller;

import com.shareloop.dto.support.AdminSupportRequestResponse;
import com.shareloop.dto.support.UpdateSupportRequestAdminRequest;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.SupportRequestService;
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

@Tag(name = "Admin Support Requests", description = "Administrative management of support requests")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/support-requests")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSupportRequestController {

    private final SupportRequestService supportRequestService;

    public AdminSupportRequestController(SupportRequestService supportRequestService) {
        this.supportRequestService = supportRequestService;
    }

    @Operation(summary = "List all support requests with optional status and category filters (Admin only)")
    @GetMapping
    public ResponseEntity<Page<AdminSupportRequestResponse>> getAdminSupportRequests(
            @RequestParam(required = false) SupportRequestStatus status,
            @RequestParam(required = false) SupportCategory category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<AdminSupportRequestResponse> response = supportRequestService.getAdminSupportRequests(status, category, page, size, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Inspect details of a support request including internal notes (Admin only)")
    @GetMapping("/{id}")
    public ResponseEntity<AdminSupportRequestResponse> getAdminSupportRequestDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminSupportRequestResponse response = supportRequestService.getAdminSupportRequestDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update support request status, public response, or internal notes (Admin only)")
    @PatchMapping("/{id}")
    public ResponseEntity<AdminSupportRequestResponse> updateSupportRequestAdmin(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSupportRequestAdminRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminSupportRequestResponse response = supportRequestService.updateSupportRequestAdmin(id, request, principal);
        return ResponseEntity.ok(response);
    }
}
