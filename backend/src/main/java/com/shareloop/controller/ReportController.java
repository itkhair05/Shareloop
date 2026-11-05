package com.shareloop.controller;

import com.shareloop.dto.report.CreateReportRequest;
import com.shareloop.dto.report.ReportResponse;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.DomainAttachmentService;
import com.shareloop.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Reports", description = "Violation and misconduct reporting on users, listings, transactions, and reviews")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;
    private final DomainAttachmentService domainAttachmentService;

    public ReportController(ReportService reportService, DomainAttachmentService domainAttachmentService) {
        this.reportService = reportService;
        this.domainAttachmentService = domainAttachmentService;
    }

    @Operation(summary = "Submit a violation report against a user, listing, transaction, or review")
    @PostMapping
    public ResponseEntity<ReportResponse> createReport(
            @Valid @RequestBody CreateReportRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ReportResponse response = reportService.createReport(request, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get current user's submitted violation reports")
    @GetMapping("/my")
    public ResponseEntity<Page<ReportResponse>> getMyReports(
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ReportResponse> response = reportService.getMyReports(status, page, size, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get details of a specific submitted report")
    @GetMapping("/{id}")
    public ResponseEntity<ReportResponse> getReportDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ReportResponse response = reportService.getReportDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Retrieve report evidence attachment",
            description = "Private evidence retrieval restricted to the reporter and administrators."
    )
    @GetMapping("/attachments/{fileId}")
    public ResponseEntity<Resource> getReportAttachment(
            @PathVariable UUID fileId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DomainAttachmentService.AttachmentResource attachment =
                domainAttachmentService.loadReportAttachment(fileId, principal);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.filename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(attachment.resource());
    }
}
