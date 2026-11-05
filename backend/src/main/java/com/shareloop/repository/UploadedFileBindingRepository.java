package com.shareloop.repository;

import com.shareloop.entity.UploadedFileBinding;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UploadedFileBindingRepository extends JpaRepository<UploadedFileBinding, UUID> {

    boolean existsByFileId(UUID fileId);

    Optional<UploadedFileBinding> findByFileId(UUID fileId);

    List<UploadedFileBinding> findByBoundDomainAndBoundEntityIdOrderByCreatedAtAsc(String boundDomain, UUID boundEntityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM UploadedFileBinding b WHERE b.fileId = :fileId")
    Optional<UploadedFileBinding> findByIdForUpdate(@Param("fileId") UUID fileId);

    long countByBoundDomainAndBoundEntityId(String boundDomain, UUID boundEntityId);
}

