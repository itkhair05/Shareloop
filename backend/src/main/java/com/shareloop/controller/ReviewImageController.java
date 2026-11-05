package com.shareloop.controller;

import com.shareloop.security.UserPrincipal;
import com.shareloop.service.DomainAttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Reviews", description = "Participant ratings, reputation feedback, and moderation")
@RestController
public class ReviewImageController {

    private final DomainAttachmentService domainAttachmentService;

    public ReviewImageController(DomainAttachmentService domainAttachmentService) {
        this.domainAttachmentService = domainAttachmentService;
    }

    /**
     * Retrieve a review image. Public for visible reviews; images of hidden
     * reviews return 404 unless the caller is an administrator.
     */
    @Operation(
            summary = "Retrieve review image",
            description = "Public for visible reviews. Hidden review images are not disclosed except to administrators."
    )
    @GetMapping("/api/v1/review-images/{fileId}")
    public ResponseEntity<Resource> getReviewImage(
            @PathVariable UUID fileId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DomainAttachmentService.AttachmentResource image =
                domainAttachmentService.loadReviewImage(fileId, principal);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.filename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(image.resource());
    }
}
