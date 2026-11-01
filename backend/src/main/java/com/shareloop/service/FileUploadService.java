package com.shareloop.service;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.FileStorageService;
import com.shareloop.service.filestorage.ImageFileValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
public class FileUploadService {

    private static final Logger log = LoggerFactory.getLogger(FileUploadService.class);

    private final FileStorageService fileStorageService;
    private final ImageFileValidator imageFileValidator;
    private final UploadedFileRepository uploadedFileRepository;
    private final UserRepository userRepository;

    public FileUploadService(
            FileStorageService fileStorageService,
            ImageFileValidator imageFileValidator,
            UploadedFileRepository uploadedFileRepository,
            UserRepository userRepository
    ) {
        this.fileStorageService = fileStorageService;
        this.imageFileValidator = imageFileValidator;
        this.uploadedFileRepository = uploadedFileRepository;
        this.userRepository = userRepository;
    }

    public FileUploadResponse uploadImage(MultipartFile file, UserPrincipal principal) {
        return uploadImage(file, UploadPurpose.GENERAL, principal);
    }

    /**
     * Authenticated image upload handler.
     * Enforces:
     * - Authentication.
     * - Content validation (binary signature, MIME, decodability, dimension limits).
     * - Safe storage abstraction.
     * - Ownership registry persistence; the physical file is deleted if the
     *   registry insert fails so no partially registered upload remains.
     */
    public FileUploadResponse uploadImage(MultipartFile file, UploadPurpose purpose, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to upload files");
        }

        UploadPurpose resolvedPurpose = purpose != null ? purpose : UploadPurpose.GENERAL;

        ImageFileValidator.ValidationResult result = imageFileValidator.validate(file);

        FileUploadResponse stored = fileStorageService.store(result.bytes(), result.extension(), result.contentType());

        try {
            UploadedFile registry = new UploadedFile(
                    UUID.fromString(stored.getId()),
                    stored.getFilename(),
                    userRepository.getReferenceById(principal.getId()),
                    stored.getContentType(),
                    stored.getSize(),
                    resolvedPurpose
            );
            uploadedFileRepository.saveAndFlush(registry);
        } catch (RuntimeException ex) {
            deleteStoredFileQuietly(stored.getFilename());
            throw ex;
        }

        return stored;
    }

    private void deleteStoredFileQuietly(String filename) {
        try {
            fileStorageService.delete(filename);
            log.info("Compensated/deleted stored file {} after upload registry failure", filename);
        } catch (Exception ce) {
            log.error("Failed to compensate stored file {}: {}", filename, ce.getMessage());
        }
    }
}
