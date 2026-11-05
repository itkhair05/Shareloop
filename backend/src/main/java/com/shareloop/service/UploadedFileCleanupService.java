package com.shareloop.service;

import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.enums.DeletionState;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.repository.UploadedFileBindingRepository;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Deletes uploads (CHAT, REVIEW, REPORT, SUPPORT) that were never attached to a domain record.
 *
 * Schedule: hourly by default (app.uploads.cleanup.cron).
 * TTL: 24 hours by default (app.uploads.cleanup.ttl-hours).
 *
 * Lifecycle:
 *   ACTIVE -> PENDING_DELETION (committed) -> physical deletion -> row deletion.
 * The physical object is never removed before the transaction that makes the row
 * unavailable for binding has committed. If physical deletion fails, the row stays
 * PENDING_DELETION and the next pass retries it; repeated runs are idempotent.
 *
 * Safety:
 * - Only cleanup-eligible purposes (CHAT, REVIEW, REPORT, SUPPORT) are considered;
 *   GENERAL uploads (listing images and user avatars) are never touched.
 * - Each row is re-read and locked FOR UPDATE before every transition, so a
 *   concurrent binding either wins (row skipped) or is rejected because the row is
 *   pending deletion.
 * - A missing physical file counts as a completed deletion.
 * - One failure never stops the rest of the batch.
 */
@Service
public class UploadedFileCleanupService {

    private static final Logger log = LoggerFactory.getLogger(UploadedFileCleanupService.class);

    private static final int MAX_BATCHES_PER_RUN = 20;

    public static final Set<UploadPurpose> CLEANUP_PURPOSES = Set.of(
            UploadPurpose.CHAT,
            UploadPurpose.REVIEW,
            UploadPurpose.REPORT,
            UploadPurpose.SUPPORT
    );

    private final UploadedFileRepository uploadedFileRepository;
    private final UploadedFileBindingRepository uploadedFileBindingRepository;
    private final FileStorageService fileStorageService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    @Value("${app.uploads.cleanup.ttl-hours:24}")
    private long ttlHours = 24;

    @Value("${app.uploads.cleanup.batch-size:100}")
    private int batchSize = 100;

    public UploadedFileCleanupService(
            UploadedFileRepository uploadedFileRepository,
            UploadedFileBindingRepository uploadedFileBindingRepository,
            FileStorageService fileStorageService,
            PlatformTransactionManager transactionManager,
            Clock clock
    ) {
        this.uploadedFileRepository = uploadedFileRepository;
        this.uploadedFileBindingRepository = uploadedFileBindingRepository;
        this.fileStorageService = fileStorageService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    @Scheduled(cron = "${app.uploads.cleanup.cron:0 0 * * * *}")
    public void scheduledCleanup() {
        int deleted = cleanupExpiredUnboundUploads();
        if (deleted > 0) {
            log.info("Cleaned up {} expired unbound uploads", deleted);
        }
    }

    /**
     * Runs one cleanup pass. Public so tests and operational tooling can invoke it directly.
     *
     * @return number of registry rows finalized (deleted) in this pass
     */
    public int cleanupExpiredUnboundUploads() {
        long effectiveTtl = Math.max(1, ttlHours);
        int effectiveBatchSize = Math.max(1, batchSize);
        Instant cutoff = clock.instant().minus(effectiveTtl, ChronoUnit.HOURS);

        int marked = markExpiredAsPending(cutoff, effectiveBatchSize);
        int finalized = finalizePendingDeletions(effectiveBatchSize);

        if (marked > 0) {
            log.info("Marked {} expired unbound uploads as pending deletion", marked);
        }
        return finalized;
    }

    private int markExpiredAsPending(Instant cutoff, int effectiveBatchSize) {
        int markedTotal = 0;
        Set<UUID> failedThisPass = new HashSet<>();

        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            List<UUID> candidates = retainUnfailed(
                    uploadedFileRepository.findExpiredUnboundIdsByPurposes(
                            CLEANUP_PURPOSES,
                            DeletionState.ACTIVE,
                            cutoff,
                            PageRequest.of(0, effectiveBatchSize)
                    ),
                    failedThisPass
            );
            if (candidates.isEmpty()) {
                break;
            }

            int markedInBatch = 0;
            for (UUID id : candidates) {
                if (markPendingIfEligible(id, cutoff)) {
                    markedInBatch++;
                } else {
                    failedThisPass.add(id);
                }
            }
            markedTotal += markedInBatch;

            if (markedInBatch == 0) {
                break;
            }
        }

        return markedTotal;
    }

    private boolean markPendingIfEligible(UUID uploadId, Instant cutoff) {
        try {
            Boolean marked = transactionTemplate.execute(status -> {
                UploadedFile file = uploadedFileRepository.findByIdForUpdate(uploadId).orElse(null);
                if (file == null) {
                    return false;
                }
                if (file.getDeletionState() != DeletionState.ACTIVE) {
                    return false;
                }
                if (file.isBound() || uploadedFileBindingRepository.existsById(uploadId)) {
                    return false;
                }
                if (!CLEANUP_PURPOSES.contains(file.getPurpose())
                        || file.getPurpose() == UploadPurpose.GENERAL
                        || file.getCreatedAt() == null
                        || !file.getCreatedAt().isBefore(cutoff)) {
                    return false;
                }

                file.markPendingDeletion(clock.instant());
                uploadedFileRepository.saveAndFlush(file);
                return true;
            });
            return Boolean.TRUE.equals(marked);
        } catch (RuntimeException ex) {
            log.error("Failed to mark expired upload {} as pending deletion: {}", uploadId, ex.getMessage());
            return false;
        }
    }

    private int finalizePendingDeletions(int effectiveBatchSize) {
        int finalizedTotal = 0;
        Set<UUID> failedThisPass = new HashSet<>();

        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            List<UUID> candidates = retainUnfailed(
                    uploadedFileRepository.findPendingDeletionIds(
                            DeletionState.PENDING_DELETION,
                            PageRequest.of(0, effectiveBatchSize)
                    ),
                    failedThisPass
            );
            if (candidates.isEmpty()) {
                break;
            }

            int finalizedInBatch = 0;
            for (UUID id : candidates) {
                if (finalizePendingDeletion(id)) {
                    finalizedInBatch++;
                } else {
                    failedThisPass.add(id);
                }
            }
            finalizedTotal += finalizedInBatch;

            if (finalizedInBatch == 0) {
                break;
            }
        }

        return finalizedTotal;
    }

    private boolean finalizePendingDeletion(UUID uploadId) {
        PendingDeletion attempt;
        try {
            attempt = transactionTemplate.execute(status -> {
                UploadedFile file = uploadedFileRepository.findByIdForUpdate(uploadId).orElse(null);
                if (file == null || file.getDeletionState() != DeletionState.PENDING_DELETION) {
                    return null;
                }
                if (!CLEANUP_PURPOSES.contains(file.getPurpose())) {
                    log.error("Upload {} is pending deletion but has non-cleanup purpose {}; refusing to delete it",
                            uploadId, file.getPurpose());
                    return null;
                }
                if (file.isBound() || uploadedFileBindingRepository.existsById(uploadId)) {
                    log.error("Pending-deletion upload {} is unexpectedly bound; refusing to delete it", uploadId);
                    return null;
                }

                file.registerDeletionAttempt();
                uploadedFileRepository.saveAndFlush(file);
                return new PendingDeletion(file.getFilename(), file.getDeletionAttempts());
            });
        } catch (RuntimeException ex) {
            log.error("Failed to load pending-deletion upload {}: {}", uploadId, ex.getMessage());
            return false;
        }

        if (attempt == null) {
            return false;
        }

        // Physical deletion happens only after the PENDING_DELETION transition is committed.
        try {
            fileStorageService.delete(attempt.filename());
        } catch (RuntimeException ex) {
            log.warn("Physical deletion of upload {} failed on attempt {}; the row remains PENDING_DELETION for retry: {}",
                    uploadId, attempt.attempt(), ex.getMessage());
            return false;
        }

        try {
            Boolean deleted = transactionTemplate.execute(status -> {
                UploadedFile file = uploadedFileRepository.findByIdForUpdate(uploadId).orElse(null);
                if (file == null) {
                    return false;
                }
                if (file.getDeletionState() != DeletionState.PENDING_DELETION) {
                    log.error("Deletion of upload {} was reversed after physical deletion; refusing to remove the row", uploadId);
                    return false;
                }
                if (!CLEANUP_PURPOSES.contains(file.getPurpose())) {
                    log.error("Upload {} changed to non-cleanup purpose {} after physical deletion; refusing to remove the row",
                            uploadId, file.getPurpose());
                    return false;
                }
                if (file.isBound() || uploadedFileBindingRepository.existsById(uploadId)) {
                    log.error("Upload {} became bound after physical deletion; refusing to remove the row", uploadId);
                    return false;
                }

                uploadedFileRepository.delete(file);
                return true;
            });

            if (Boolean.TRUE.equals(deleted)) {
                log.info("Deleted expired unbound upload {} after {} attempt(s)", uploadId, attempt.attempt());
                return true;
            }
            return false;
        } catch (RuntimeException ex) {
            log.error("Physical file {} was deleted but registry row {} could not be finalized; "
                            + "it stays PENDING_DELETION and will be retried: {}",
                    attempt.filename(), uploadId, ex.getMessage());
            return false;
        }
    }

    private static List<UUID> retainUnfailed(List<UUID> ids, Set<UUID> failedThisPass) {
        List<UUID> candidates = new ArrayList<>(ids.size());
        for (UUID id : ids) {
            if (!failedThisPass.contains(id)) {
                candidates.add(id);
            }
        }
        return candidates;
    }

    private record PendingDeletion(String filename, int attempt) {
    }
}
