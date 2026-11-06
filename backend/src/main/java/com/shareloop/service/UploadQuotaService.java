package com.shareloop.service;

import com.shareloop.config.UploadQuotaProperties;
import com.shareloop.entity.UploadedFile;
import com.shareloop.exception.UploadQuotaExceededException;
import com.shareloop.repository.UploadedFileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Registers an uploaded file while enforcing the rolling per-user quota.
 *
 * <p>The quota check, advisory lock and registry insert run in one database
 * transaction. Concurrent uploads for the same owner are therefore serialized
 * across application instances, and a failed insert rolls the lock back with
 * the transaction. The physical object is stored before this call and is
 * deleted by the caller when this method throws.</p>
 */
@Service
public class UploadQuotaService {

    public static final String QUOTA_EXCEEDED_MESSAGE =
            "Bạn đã vượt quá hạn mức dung lượng tải lên trong khoảng thời gian này. Vui lòng thử lại sau.";

    private final UploadedFileRepository uploadedFileRepository;
    private final UploadQuotaProperties properties;
    private final Clock clock;

    public UploadQuotaService(
            UploadedFileRepository uploadedFileRepository,
            UploadQuotaProperties properties,
            Clock clock
    ) {
        if (properties.isEnabled()
                && (properties.getUserPeriodBytes() <= 0 || properties.getUserPeriodHours() <= 0)) {
            throw new IllegalStateException(
                    "app.uploads.quota requires positive user-period-bytes and user-period-hours when enabled."
            );
        }
        this.uploadedFileRepository = uploadedFileRepository;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public void checkQuotaAndRegister(UploadedFile registry) {
        if (!properties.isEnabled()) {
            uploadedFileRepository.saveAndFlush(registry);
            return;
        }

        UUID ownerId = registry.getOwner().getId();
        uploadedFileRepository.acquireQuotaAdvisoryLock(ownerId.toString());

        Instant windowStart = clock.instant().minus(properties.getUserPeriodHours(), ChronoUnit.HOURS);
        long usedBytes = uploadedFileRepository.sumSizeBytesByOwnerIdAndCreatedAtAfter(ownerId, windowStart);
        long quota = properties.getUserPeriodBytes();
        long size = registry.getSizeBytes();

        if (usedBytes > quota || size > quota - usedBytes) {
            throw new UploadQuotaExceededException(QUOTA_EXCEEDED_MESSAGE);
        }

        uploadedFileRepository.saveAndFlush(registry);
    }
}
