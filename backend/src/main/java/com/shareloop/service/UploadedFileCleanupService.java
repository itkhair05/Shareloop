package com.shareloop.service;

import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.service.filestorage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Deletes CHAT uploads that were never attached to a message.
 *
 * Schedule: hourly by default (app.uploads.cleanup.cron).
 * TTL: 24 hours by default (app.uploads.cleanup.ttl-hours).
 *
 * Safety:
 * - Only purpose=CHAT uploads are considered; GENERAL uploads (listing images) are never touched.
 * - Each row is re-read and locked FOR UPDATE, then rechecked for binding state before deletion,
 *   so a concurrent message binding either wins (row skipped) or loses (upload no longer exists).
 * - Each row is handled in its own transaction; one failure does not stop the batch.
 * - A missing physical file does not block removal of the registry row.
 */
@Service
public class UploadedFileCleanupService {

    private static final Logger log = LoggerFactory.getLogger(UploadedFileCleanupService.class);

    private static final int MAX_BATCHES_PER_RUN = 20;

    private final UploadedFileRepository uploadedFileRepository;
    private final FileStorageService fileStorageService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    @Value("${app.uploads.cleanup.ttl-hours:24}")
    private long ttlHours = 24;

    @Value("${app.uploads.cleanup.batch-size:100}")
    private int batchSize = 100;

    public UploadedFileCleanupService(
            UploadedFileRepository uploadedFileRepository,
            FileStorageService fileStorageService,
            PlatformTransactionManager transactionManager,
            Clock clock
    ) {
        this.uploadedFileRepository = uploadedFileRepository;
        this.fileStorageService = fileStorageService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    @Scheduled(cron = "${app.uploads.cleanup.cron:0 0 * * * *}")
    public void scheduledCleanup() {
        int deleted = cleanupExpiredUnboundUploads();
        if (deleted > 0) {
            log.info("Cleaned up {} expired unbound chat uploads", deleted);
        }
    }

    /**
     * Runs one cleanup pass. Public so tests and operational tooling can invoke it directly.
     *
     * @return number of registry rows deleted in this pass
     */
    public int cleanupExpiredUnboundUploads() {
        long effectiveTtl = Math.max(1, ttlHours);
        int effectiveBatchSize = Math.max(1, batchSize);
        Instant cutoff = clock.instant().minus(effectiveTtl, ChronoUnit.HOURS);

        int deletedTotal = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            List<UUID> ids = uploadedFileRepository.findExpiredUnboundIds(
                    UploadPurpose.CHAT,
                    cutoff,
                    PageRequest.of(0, effectiveBatchSize)
            );
            if (ids.isEmpty()) {
                break;
            }

            int deletedInBatch = 0;
            for (UUID id : ids) {
                if (deleteIfStillExpiredAndUnbound(id, cutoff)) {
                    deletedInBatch++;
                }
            }
            deletedTotal += deletedInBatch;

            // Avoid re-processing the same rows forever when deletions keep failing.
            if (deletedInBatch == 0) {
                break;
            }
        }
        return deletedTotal;
    }

    private boolean deleteIfStillExpiredAndUnbound(UUID uploadId, Instant cutoff) {
        try {
            Boolean deleted = transactionTemplate.execute(status -> {
                UploadedFile file = uploadedFileRepository.findByIdForUpdate(uploadId).orElse(null);
                if (file == null) {
                    return false;
                }
                if (file.isBound()
                        || file.getPurpose() != UploadPurpose.CHAT
                        || file.getCreatedAt() == null
                        || !file.getCreatedAt().isBefore(cutoff)) {
                    return false;
                }

                try {
                    fileStorageService.delete(file.getFilename());
                } catch (RuntimeException ex) {
                    // Keep the registry row so the next pass can retry; do not abort the batch.
                    throw new CleanupSkippedException(file.getFilename(), ex);
                }

                uploadedFileRepository.delete(file);
                return true;
            });
            return Boolean.TRUE.equals(deleted);
        } catch (CleanupSkippedException ex) {
            log.warn("Skipped cleanup of upload {} because the stored file could not be deleted: {}",
                    uploadId, ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage());
            return false;
        } catch (RuntimeException ex) {
            log.error("Failed to clean up expired upload {}: {}", uploadId, ex.getMessage());
            return false;
        }
    }

    private static final class CleanupSkippedException extends RuntimeException {
        private CleanupSkippedException(String filename, Throwable cause) {
            super("Could not delete stored file " + filename, cause);
        }
    }
}
