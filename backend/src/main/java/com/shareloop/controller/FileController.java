package com.shareloop.controller;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.FileUploadService;
import com.shareloop.service.filestorage.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "File Storage", description = "Secure image upload (JPEG/PNG max 5 MiB) and public resource delivery")
@RestController
@RequestMapping("/api/v1/files")
public class FileController {

    private final FileUploadService fileUploadService;
    private final FileStorageService fileStorageService;
    private final UploadedFileRepository uploadedFileRepository;

    public FileController(
            FileUploadService fileUploadService,
            FileStorageService fileStorageService,
            UploadedFileRepository uploadedFileRepository
    ) {
        this.fileUploadService = fileUploadService;
        this.fileStorageService = fileStorageService;
        this.uploadedFileRepository = uploadedFileRepository;
    }

    /**
     * Authenticated endpoint to upload an image (JPEG or PNG, max 5 MiB).
     * purpose=CHAT marks the upload as a private chat attachment candidate.
     */
    @Operation(summary = "Upload image file", description = "Upload a JPEG or PNG image (max 5 MiB, max 4096px, max 16MP). Returns generated file metadata and public access URL.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FileUploadResponse> uploadFile(
            @Parameter(description = "Image file (JPEG or PNG, up to 5 MiB)")
            @RequestParam("file") MultipartFile file,
            @Parameter(description = "Upload purpose: GENERAL (default) or CHAT for private chat attachments")
            @RequestParam(value = "purpose", defaultValue = "GENERAL") UploadPurpose purpose,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        FileUploadResponse response = fileUploadService.uploadImage(file, purpose, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Public endpoint to serve an uploaded image by its server-generated filename.
     * Files bound to a chat message are private and are never served here.
     */
    @Operation(summary = "Retrieve uploaded file", description = "Publicly accessible endpoint to retrieve an image by its server-generated filename. Chat attachments are excluded.")
    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        if (uploadedFileRepository.existsByFilenameAndBoundMessageIdIsNotNull(filename)) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        Resource resource = fileStorageService.loadAsResource(filename);
        String contentType = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }
}
