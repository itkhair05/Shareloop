package com.shareloop.repository;

import com.shareloop.entity.ReportAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportAttachmentRepository extends JpaRepository<ReportAttachment, UUID> {

    List<ReportAttachment> findByReportIdOrderByDisplayOrderAsc(UUID reportId);

    @Query("SELECT a FROM ReportAttachment a " +
            "WHERE a.report.id IN :reportIds " +
            "ORDER BY a.report.id ASC, a.displayOrder ASC")
    List<ReportAttachment> findByReportIdsOrderByDisplayOrderAsc(@Param("reportIds") Collection<UUID> reportIds);

    Optional<ReportAttachment> findByFileId(UUID fileId);
}
