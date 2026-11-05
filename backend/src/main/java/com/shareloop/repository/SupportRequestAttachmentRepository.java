package com.shareloop.repository;

import com.shareloop.entity.SupportRequestAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportRequestAttachmentRepository extends JpaRepository<SupportRequestAttachment, UUID> {

    List<SupportRequestAttachment> findBySupportRequestIdOrderByDisplayOrderAsc(UUID supportRequestId);

    @Query("SELECT a FROM SupportRequestAttachment a " +
            "WHERE a.supportRequest.id IN :supportRequestIds " +
            "ORDER BY a.supportRequest.id ASC, a.displayOrder ASC")
    List<SupportRequestAttachment> findBySupportRequestIdsOrderByDisplayOrderAsc(
            @Param("supportRequestIds") Collection<UUID> supportRequestIds);

    Optional<SupportRequestAttachment> findByFileId(UUID fileId);
}
