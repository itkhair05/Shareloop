package com.shareloop.service;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.FileStorageService;
import com.shareloop.service.filestorage.ImageFileValidator;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileUploadService {

    private final FileStorageService fileStorageService;
    private final ImageFileValidator imageFileValidator;

    public FileUploadService(FileStorageService fileStorageService, ImageFileValidator imageFileValidator) {
        this.fileStorageService = fileStorageService;
        this.imageFileValidator = imageFileValidator;
    }

    /**
     * Authenticated image upload handler.
     * Enforces:
     * - Authentication.
     * - Content validation (binary signature, MIME, decodability, dimension limits).
     * - Safe storage abstraction.
     */
    public FileUploadResponse uploadImage(MultipartFile file, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to upload files");
        }

        ImageFileValidator.ValidationResult result = imageFileValidator.validate(file);

        return fileStorageService.store(result.bytes(), result.extension(), result.contentType());
    }
}
