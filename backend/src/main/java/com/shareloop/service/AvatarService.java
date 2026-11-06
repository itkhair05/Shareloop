package com.shareloop.service;

import com.shareloop.config.StorageProperties;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.User;
import com.shareloop.exception.InvalidTokenException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.UserRepository;
import com.shareloop.service.filestorage.FileStorageService;
import com.shareloop.service.filestorage.ImageFileValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service managing user avatar upload, replacement, and deletion.
 * Enforces transaction boundaries, compensation on persistence failure,
 * pessimistic row locking during concurrent operations, and safe post-commit file cleanup.
 */
@Service
public class AvatarService {

    private static final Logger log = LoggerFactory.getLogger(AvatarService.class);

    private static final Pattern MANAGED_AVATAR_FILENAME_PATTERN =
            Pattern.compile("^(?:/api/v1/files/)?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(?:jpg|jpeg|png))$");

    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final ImageFileValidator imageFileValidator;
    private final TransactionTemplate transactionTemplate;
    private final List<String> managedAbsolutePrefixes;

    public AvatarService(
            UserRepository userRepository,
            FileStorageService fileStorageService,
            ImageFileValidator imageFileValidator,
            PlatformTransactionManager transactionManager,
            StorageProperties storageProperties
    ) {
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.imageFileValidator = imageFileValidator;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.managedAbsolutePrefixes = resolveManagedAbsolutePrefixes(storageProperties);
    }

    /**
     * Uploads or replaces a user's custom avatar.
     * Flow:
     * 1. Validates image content (magic bytes, size <= 5MB, decodable, max 4096px/16MP, reject SVG).
     * 2. Stores file on disk via safe UUID filename.
     * 3. Executes transactional update with pessimistic row lock (findByIdForUpdate).
     * 4. Compensates by deleting newly saved file if database update fails.
     * 5. Cleans up previous custom avatar file outside the committed transaction.
     */
    public UserProfileResponse uploadAvatar(UUID userId, MultipartFile file) {
        if (userId == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file cannot be empty");
        }

        // 1. Validate image content
        ImageFileValidator.ValidationResult validation = imageFileValidator.validate(file);

        // 2. Store new file
        FileUploadResponse uploadResponse = fileStorageService.store(
                validation.bytes(),
                validation.extension(),
                validation.contentType()
        );
        String newAvatarUrl = uploadResponse.getUrl();
        String newFilename = uploadResponse.getFilename();

        // 3. Update database row inside transaction with pessimistic lock
        AvatarUpdateResult result;
        try {
            result = transactionTemplate.execute(status -> {
                User user = userRepository.findByIdForUpdate(userId)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

                String oldCustomAvatarUrl = user.getAvatarUrl();
                user.updateCustomAvatar(newAvatarUrl);
                User savedUser = userRepository.save(user);

                return new AvatarUpdateResult(savedUser, oldCustomAvatarUrl);
            });
        } catch (Exception e) {
            // Compensation: delete the newly stored file
            try {
                fileStorageService.delete(newFilename);
                log.info("Compensated/deleted orphaned new avatar file {} after database error", newFilename);
            } catch (Exception ce) {
                log.error("Failed to compensate new avatar file {}: {}", newFilename, ce.getMessage());
            }
            throw e;
        }

        // 4. Clean up previous custom avatar outside committed transaction
        if (result != null) {
            cleanupPreviousCustomAvatar(result.oldCustomAvatarUrl(), newFilename);
            return UserProfileResponse.fromEntity(result.user());
        }

        throw new IllegalStateException("Avatar update transaction returned null result");
    }

    /**
     * Deletes the user's custom avatar.
     * Sets avatar_url to null and updates avatar_updated_at.
     * Preserves google_avatar_url.
     * Idempotent: returns success even if custom avatar was already null.
     */
    public UserProfileResponse deleteAvatar(UUID userId) {
        if (userId == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }

        // 1. Transactional update with pessimistic lock
        AvatarDeleteResult result = transactionTemplate.execute(status -> {
            User user = userRepository.findByIdForUpdate(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

            String oldCustomAvatarUrl = user.getAvatarUrl();
            if (oldCustomAvatarUrl != null) {
                user.clearCustomAvatar();
                user = userRepository.save(user);
            }

            return new AvatarDeleteResult(user, oldCustomAvatarUrl);
        });

        // 2. Clean up previous custom avatar file outside committed transaction
        if (result != null) {
            if (result.oldCustomAvatarUrl() != null) {
                cleanupPreviousCustomAvatar(result.oldCustomAvatarUrl(), null);
            }
            return UserProfileResponse.fromEntity(result.user());
        }

        throw new IllegalStateException("Avatar delete transaction returned null result");
    }

    /**
     * Safely cleans up the previous custom avatar file.
     * Only deletes files matching server-generated managed UUID filenames.
     * Never deletes Google avatars or arbitrary URLs.
     */
    private void cleanupPreviousCustomAvatar(String oldAvatarUrl, String activeNewFilename) {
        if (oldAvatarUrl == null || oldAvatarUrl.isBlank()) {
            return;
        }

        String filenameToDelete = extractManagedFilename(oldAvatarUrl);
        if (filenameToDelete == null) {
            log.debug("Skipping cleanup for non-managed avatar URL: {}", oldAvatarUrl);
            return;
        }

        if (filenameToDelete.equalsIgnoreCase(activeNewFilename)) {
            log.debug("Skipping cleanup: old filename matches active new filename {}", activeNewFilename);
            return;
        }

        try {
            boolean deleted = fileStorageService.delete(filenameToDelete);
            if (deleted) {
                log.info("Successfully cleaned up previous custom avatar file: {}", filenameToDelete);
            } else {
                log.debug("Previous custom avatar file was not found on disk during cleanup: {}", filenameToDelete);
            }
        } catch (Exception e) {
            log.warn("Failed to clean up previous custom avatar file {}: {}", filenameToDelete, e.getMessage());
        }
    }

    /**
     * Extracts server-generated UUID filename from a managed relative or absolute avatar URL.
     * Returns null for Google avatar URLs or unrecognized paths.
     */
    public String extractManagedFilename(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) {
            return null;
        }
        String trimmed = avatarUrl.trim();

        // Legacy absolute object-storage URLs (for example a previous R2/CDN base URL).
        for (String prefix : managedAbsolutePrefixes) {
            if (trimmed.startsWith(prefix + "/")) {
                String candidate = trimmed.substring(prefix.length() + 1);
                Matcher matcher = MANAGED_AVATAR_FILENAME_PATTERN.matcher(candidate);
                if (matcher.matches()) {
                    return matcher.group(1);
                }
            }
        }

        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            int idx = trimmed.indexOf("/api/v1/files/");
            if (idx != -1) {
                String pathPart = trimmed.substring(idx);
                Matcher matcher = MANAGED_AVATAR_FILENAME_PATTERN.matcher(pathPart);
                if (matcher.matches()) {
                    return matcher.group(1);
                }
            }
            return null;
        }

        Matcher matcher = MANAGED_AVATAR_FILENAME_PATTERN.matcher(trimmed);
        if (matcher.matches()) {
            return matcher.group(1);
        }

        return null;
    }

    private static List<String> resolveManagedAbsolutePrefixes(StorageProperties storageProperties) {
        List<String> prefixes = new ArrayList<>();
        if (storageProperties == null) {
            return prefixes;
        }
        addAbsolutePrefix(prefixes, storageProperties.getR2().getPublicUrlPrefix());
        addAbsolutePrefix(prefixes, storageProperties.getLocal().getBaseUrl());
        return List.copyOf(prefixes);
    }

    private static void addAbsolutePrefix(List<String> prefixes, String value) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return;
        }
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (!trimmed.isBlank()) {
            prefixes.add(trimmed);
        }
    }

    private record AvatarUpdateResult(User user, String oldCustomAvatarUrl) {}
    private record AvatarDeleteResult(User user, String oldCustomAvatarUrl) {}
}
