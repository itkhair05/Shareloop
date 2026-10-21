package com.shareloop.controller;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.FileUploadService;
import com.shareloop.service.filestorage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/files")
public class FileController {

    private final FileUploadService fileUploadService;
    private final FileStorageService fileStorageService;

    public FileController(FileUploadService fileUploadService, FileStorageService fileStorageService) {
        this.fileUploadService = fileUploadService;
        this.fileStorageService = fileStorageService;
    }

    /**
     * Authenticated endpoint to upload an image (JPEG or PNG, max 5 MiB).
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FileUploadResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        FileUploadResponse response = fileUploadService.uploadImage(file, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Public endpoint to serve an uploaded image by its server-generated filename.
     */
    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        Resource resource = fileStorageService.loadAsResource(filename);
        String contentType = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }
}
