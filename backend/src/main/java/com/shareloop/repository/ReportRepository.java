package com.shareloop.repository;

import com.shareloop.entity.Report;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {

    boolean existsByReporterIdAndTargetTypeAndTargetIdAndStatusIn(
            UUID reporterId,
            ReportTargetType targetType,
            UUID targetId,
            Collection<ReportStatus> statuses
    );

    Page<Report> findByReporterId(UUID reporterId, Pageable pageable);

    Page<Report> findByReporterIdAndStatus(UUID reporterId, ReportStatus status, Pageable pageable);

    @Query(value = "SELECT r FROM Report r " +
            "JOIN FETCH r.reporter rep " +
            "LEFT JOIN FETCH r.resolvedBy rb " +
            "WHERE (:status IS NULL OR r.status = :status) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType) " +
            "AND (:category IS NULL OR r.category = :category)",
            countQuery = "SELECT count(r) FROM Report r " +
            "WHERE (:status IS NULL OR r.status = :status) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType) " +
            "AND (:category IS NULL OR r.category = :category)")
    Page<Report> findForAdmin(
            @Param("status") ReportStatus status,
            @Param("targetType") ReportTargetType targetType,
            @Param("category") ReportCategory category,
            Pageable pageable
    );

    @Query("SELECT r FROM Report r " +
            "JOIN FETCH r.reporter rep " +
            "LEFT JOIN FETCH r.resolvedBy rb " +
            "WHERE r.id = :id")
    Optional<Report> findWithDetailsById(@Param("id") UUID id);

    long countByStatus(ReportStatus status);
}
