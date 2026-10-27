package com.shareloop.controller;

import com.shareloop.dto.report.AdminReportResponse;
import com.shareloop.dto.report.UpdateReportAdminRequest;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ReportService;
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

@Tag(name = "Admin Reports", description = "Administrative moderation and investigation of violation reports")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/reports")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReportController {

    private final ReportService reportService;

    public AdminReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @Operation(summary = "List all violation reports with optional status, targetType, and category filters (Admin only)")
    @GetMapping
    public ResponseEntity<Page<AdminReportResponse>> getAdminReports(
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(required = false) ReportTargetType targetType,
            @RequestParam(required = false) ReportCategory category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<AdminReportResponse> response = reportService.getAdminReports(status, targetType, category, page, size, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Inspect details of a report including internal resolution notes (Admin only)")
    @GetMapping("/{id}")
    public ResponseEntity<AdminReportResponse> getAdminReportDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminReportResponse response = reportService.getAdminReportDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update report status and resolution notes (Admin only)")
    @PatchMapping("/{id}")
    public ResponseEntity<AdminReportResponse> updateReportAdmin(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateReportAdminRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AdminReportResponse response = reportService.updateReportAdmin(id, request, principal);
        return ResponseEntity.ok(response);
    }
}
