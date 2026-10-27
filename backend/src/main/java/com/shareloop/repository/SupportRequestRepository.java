package com.shareloop.repository;

import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportRequestRepository extends JpaRepository<SupportRequest, UUID> {

    Page<SupportRequest> findByRequesterId(UUID requesterId, Pageable pageable);

    Page<SupportRequest> findByRequesterIdAndStatus(UUID requesterId, SupportRequestStatus status, Pageable pageable);

    @Query(value = "SELECT s FROM SupportRequest s " +
            "JOIN FETCH s.requester r " +
            "LEFT JOIN FETCH s.transaction t " +
            "LEFT JOIN FETCH s.resolvedBy rb " +
            "WHERE (:status IS NULL OR s.status = :status) " +
            "AND (:category IS NULL OR s.category = :category)",
            countQuery = "SELECT count(s) FROM SupportRequest s " +
            "WHERE (:status IS NULL OR s.status = :status) " +
            "AND (:category IS NULL OR s.category = :category)")
    Page<SupportRequest> findForAdmin(
            @Param("status") SupportRequestStatus status,
            @Param("category") SupportCategory category,
            Pageable pageable
    );

    @Query("SELECT s FROM SupportRequest s " +
            "JOIN FETCH s.requester r " +
            "LEFT JOIN FETCH s.transaction t " +
            "LEFT JOIN FETCH s.resolvedBy rb " +
            "WHERE s.id = :id")
    Optional<SupportRequest> findWithDetailsById(@Param("id") UUID id);

    long countByStatus(SupportRequestStatus status);
}
