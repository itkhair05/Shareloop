package com.shareloop.repository;

import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.enums.DeletionState;
import com.shareloop.entity.enums.UploadPurpose;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UploadedFileRepository extends JpaRepository<UploadedFile, UUID> {

    Optional<UploadedFile> findByFilename(String filename);

    boolean existsByFilenameAndBoundMessageIdIsNotNull(String filename);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT f FROM UploadedFile f WHERE f.id = :id")
    Optional<UploadedFile> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Ids of cleanup-eligible uploads across multiple purposes (CHAT, REVIEW, REPORT, SUPPORT).
     * GENERAL uploads and files already pending deletion are never returned.
     */
    @Query("SELECT f.id FROM UploadedFile f " +
           "WHERE f.purpose IN :purposes " +
           "AND f.deletionState = :deletionState " +
           "AND f.boundMessageId IS NULL " +
           "AND NOT EXISTS (SELECT 1 FROM UploadedFileBinding b WHERE b.fileId = f.id) " +
           "AND f.createdAt < :cutoff " +
           "ORDER BY f.createdAt ASC, f.id ASC")
    List<UUID> findExpiredUnboundIdsByPurposes(
            @Param("purposes") java.util.Collection<UploadPurpose> purposes,
            @Param("deletionState") DeletionState deletionState,
            @Param("cutoff") Instant cutoff,
            Pageable pageable
    );

    /**
     * Ids of expired GENERAL uploads that are not referenced by any listing image.
     * Listing images are stored as URL strings, so a reference exists when the
     * stored URL is the filename itself or ends with "/" + filename.
     */
    @Query("SELECT f.id FROM UploadedFile f " +
           "WHERE f.purpose = :purpose " +
           "AND f.deletionState = :deletionState " +
           "AND f.boundMessageId IS NULL " +
           "AND NOT EXISTS (SELECT 1 FROM UploadedFileBinding b WHERE b.fileId = f.id) " +
           "AND f.createdAt < :cutoff " +
           "AND NOT EXISTS (SELECT 1 FROM ListingImage li " +
           "                WHERE li.imageUrl = f.filename " +
           "                   OR li.imageUrl LIKE CONCAT('%/', f.filename)) " +
           "ORDER BY f.createdAt ASC, f.id ASC")
    List<UUID> findOrphanedGeneralIds(
            @Param("purpose") UploadPurpose purpose,
            @Param("deletionState") DeletionState deletionState,
            @Param("cutoff") Instant cutoff,
            Pageable pageable
    );

    /**
     * Ids of files whose deletion is pending, oldest first, including rows whose
     * previous physical deletion attempt failed.
     */
    @Query("SELECT f.id FROM UploadedFile f " +
           "WHERE f.deletionState = :deletionState " +
           "ORDER BY f.pendingDeletionAt ASC, f.id ASC")
    List<UUID> findPendingDeletionIds(
            @Param("deletionState") DeletionState deletionState,
            Pageable pageable
    );

    long countByOwnerId(UUID ownerId);

    /**
     * Transaction-scoped advisory lock that serializes quota checks and inserts
     * for one owner across application instances.
     */
    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1007, hashtext(:ownerKey))) sub", nativeQuery = true)
    Integer acquireQuotaAdvisoryLock(@Param("ownerKey") String ownerKey);

    /**
     * Bytes registered by the owner since the start of the rolling quota window.
     * Rows pending physical deletion are still counted until the row is removed.
     */
    @Query("SELECT COALESCE(SUM(f.sizeBytes), 0) FROM UploadedFile f " +
           "WHERE f.owner.id = :ownerId AND f.createdAt >= :since")
    long sumSizeBytesByOwnerIdAndCreatedAtAfter(
            @Param("ownerId") UUID ownerId,
            @Param("since") Instant since
    );
}
