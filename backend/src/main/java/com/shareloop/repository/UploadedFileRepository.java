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
}
