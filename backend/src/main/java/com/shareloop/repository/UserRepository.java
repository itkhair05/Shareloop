package com.shareloop.repository;

import com.shareloop.dto.reporting.projection.ReportBucketCountProjection;
import com.shareloop.dto.reporting.projection.UserRoleCountProjection;
import com.shareloop.dto.reporting.projection.UserStatusCountProjection;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByRole(UserRole role);

    long countByRole(UserRole role);

    long countByStatus(UserStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.role = :role ORDER BY u.id ASC")
    List<User> findAdminsForUpdate(@Param("role") UserRole role);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("UPDATE User u SET u.passwordHash = :passwordHash, u.updatedAt = :updatedAt WHERE u.id = :userId AND u.passwordHash IS NULL")
    int setInitialPasswordIfNull(
            @Param("userId") UUID userId,
            @Param("passwordHash") String passwordHash,
            @Param("updatedAt") java.time.Instant updatedAt
    );

    @Query("SELECT COUNT(u) FROM User u " +
            "WHERE u.createdAt >= :from AND u.createdAt < :to " +
            "AND (:role IS NULL OR u.role = :role) " +
            "AND (:status IS NULL OR u.status = :status)")
    long countCreatedInRange(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("role") UserRole role,
            @Param("status") UserStatus status
    );

    @Query("SELECT u.role AS role, COUNT(u) AS count FROM User u " +
            "WHERE u.createdAt >= :from AND u.createdAt < :to " +
            "AND (:role IS NULL OR u.role = :role) " +
            "AND (:status IS NULL OR u.status = :status) " +
            "GROUP BY u.role")
    List<UserRoleCountProjection> countCreatedInRangeByRole(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("role") UserRole role,
            @Param("status") UserStatus status
    );

    @Query("SELECT u.status AS status, COUNT(u) AS count FROM User u " +
            "WHERE u.createdAt >= :from AND u.createdAt < :to " +
            "AND (:role IS NULL OR u.role = :role) " +
            "AND (:status IS NULL OR u.status = :status) " +
            "GROUP BY u.status")
    List<UserStatusCountProjection> countCreatedInRangeByStatus(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("role") UserRole role,
            @Param("status") UserStatus status
    );

    @Query(value = "SELECT CAST(date_trunc(CAST(:granularity AS text), u.created_at AT TIME ZONE CAST(:timezone AS text)) AS date) AS bucket, " +
            "COUNT(*) AS count " +
            "FROM users u " +
            "WHERE u.created_at >= :fromInstant AND u.created_at < :toInstant " +
            "GROUP BY bucket " +
            "ORDER BY bucket", nativeQuery = true)
    List<ReportBucketCountProjection> countCreatedInRangeByBucket(
            @Param("fromInstant") Instant fromInstant,
            @Param("toInstant") Instant toInstant,
            @Param("granularity") String granularity,
            @Param("timezone") String timezone
    );
}
