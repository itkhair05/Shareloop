package com.shareloop.repository;

import com.shareloop.entity.UploadedFile;
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
     * Ids of cleanup-eligible uploads: unbound CHAT uploads created before the cutoff.
     * GENERAL uploads (listing images and other public consumers) are never returned.
     */
    @Query("SELECT f.id FROM UploadedFile f " +
           "WHERE f.purpose = :purpose AND f.boundMessageId IS NULL AND f.createdAt < :cutoff " +
           "ORDER BY f.createdAt ASC")
    List<UUID> findExpiredUnboundIds(
            @Param("purpose") UploadPurpose purpose,
            @Param("cutoff") Instant cutoff,
            Pageable pageable
    );

    long countByOwnerId(UUID ownerId);
}
