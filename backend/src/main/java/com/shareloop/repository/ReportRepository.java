package com.shareloop.repository;

import com.shareloop.dto.reporting.projection.ReportBucketCountProjection;
import com.shareloop.dto.reporting.projection.ReportCategoryCountProjection;
import com.shareloop.dto.reporting.projection.ReportStatusCountProjection;
import com.shareloop.dto.reporting.projection.ReportTargetTypeCountProjection;
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

import java.time.Instant;
import java.util.Collection;
import java.util.List;
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

    @Query("SELECT COUNT(r) FROM Report r " +
            "WHERE r.createdAt >= :from AND r.createdAt < :to " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:category IS NULL OR r.category = :category) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType)")
    long countCreatedInRange(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ReportStatus status,
            @Param("category") ReportCategory category,
            @Param("targetType") ReportTargetType targetType
    );

    @Query("SELECT r.status AS status, COUNT(r) AS count FROM Report r " +
            "WHERE r.createdAt >= :from AND r.createdAt < :to " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:category IS NULL OR r.category = :category) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType) " +
            "GROUP BY r.status")
    List<ReportStatusCountProjection> countCreatedInRangeByStatus(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ReportStatus status,
            @Param("category") ReportCategory category,
            @Param("targetType") ReportTargetType targetType
    );

    @Query("SELECT r.category AS category, COUNT(r) AS count FROM Report r " +
            "WHERE r.createdAt >= :from AND r.createdAt < :to " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:category IS NULL OR r.category = :category) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType) " +
            "GROUP BY r.category")
    List<ReportCategoryCountProjection> countCreatedInRangeByCategory(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ReportStatus status,
            @Param("category") ReportCategory category,
            @Param("targetType") ReportTargetType targetType
    );

    @Query("SELECT r.targetType AS targetType, COUNT(r) AS count FROM Report r " +
            "WHERE r.createdAt >= :from AND r.createdAt < :to " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:category IS NULL OR r.category = :category) " +
            "AND (:targetType IS NULL OR r.targetType = :targetType) " +
            "GROUP BY r.targetType")
    List<ReportTargetTypeCountProjection> countCreatedInRangeByTargetType(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("status") ReportStatus status,
            @Param("category") ReportCategory category,
            @Param("targetType") ReportTargetType targetType
    );

    @Query(value = "SELECT CAST(date_trunc(CAST(:granularity AS text), r.created_at AT TIME ZONE CAST(:timezone AS text)) AS date) AS bucket, " +
            "COUNT(*) AS count " +
            "FROM reports r " +
            "WHERE r.created_at >= :fromInstant AND r.created_at < :toInstant " +
            "AND (CAST(:category AS text) IS NULL OR r.category = CAST(:category AS text)) " +
            "AND (CAST(:targetType AS text) IS NULL OR r.target_type = CAST(:targetType AS text)) " +
            "GROUP BY bucket " +
            "ORDER BY bucket", nativeQuery = true)
    List<ReportBucketCountProjection> countCreatedInRangeByBucket(
            @Param("fromInstant") Instant fromInstant,
            @Param("toInstant") Instant toInstant,
            @Param("granularity") String granularity,
            @Param("timezone") String timezone,
            @Param("category") String category,
            @Param("targetType") String targetType
    );
}
