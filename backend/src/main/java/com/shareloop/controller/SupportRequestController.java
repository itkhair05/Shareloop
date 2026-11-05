package com.shareloop.controller;

import com.shareloop.dto.support.CreateSupportRequest;
import com.shareloop.dto.support.SupportRequestResponse;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.DomainAttachmentService;
import com.shareloop.service.SupportRequestService;
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

@Tag(name = "Support Requests", description = "Member support requests, help inquiries, and transaction assistance")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/support-requests")
public class SupportRequestController {

    private final SupportRequestService supportRequestService;
    private final DomainAttachmentService domainAttachmentService;

    public SupportRequestController(
            SupportRequestService supportRequestService,
            DomainAttachmentService domainAttachmentService
    ) {
        this.supportRequestService = supportRequestService;
        this.domainAttachmentService = domainAttachmentService;
    }

    @Operation(summary = "Submit a new support request")
    @PostMapping
    public ResponseEntity<SupportRequestResponse> createSupportRequest(
            @Valid @RequestBody CreateSupportRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        SupportRequestResponse response = supportRequestService.createSupportRequest(request, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get current user's submitted support requests")
    @GetMapping("/my")
    public ResponseEntity<Page<SupportRequestResponse>> getMySupportRequests(
            @RequestParam(required = false) SupportRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<SupportRequestResponse> response = supportRequestService.getMySupportRequests(status, page, size, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get details of a specific support request")
    @GetMapping("/{id}")
    public ResponseEntity<SupportRequestResponse> getSupportRequestDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        SupportRequestResponse response = supportRequestService.getSupportRequestDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Retrieve support request attachment",
            description = "Private attachment retrieval restricted to the requester and administrators."
    )
    @GetMapping("/attachments/{fileId}")
    public ResponseEntity<Resource> getSupportRequestAttachment(
            @PathVariable UUID fileId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DomainAttachmentService.AttachmentResource attachment =
                domainAttachmentService.loadSupportRequestAttachment(fileId, principal);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.filename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(attachment.resource());
    }
}
