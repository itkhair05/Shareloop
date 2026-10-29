package com.shareloop.repository;

import com.shareloop.entity.ForgotPasswordAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface ForgotPasswordAttemptRepository extends JpaRepository<ForgotPasswordAttempt, UUID> {

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1002, hashtext(:ipAddress))) sub", nativeQuery = true)
    Integer acquireIpAdvisoryLock(@Param("ipAddress") String ipAddress);

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1003, hashtext(:emailHash))) sub", nativeQuery = true)
    Integer acquireEmailAdvisoryLock(@Param("emailHash") String emailHash);

    @Query("SELECT COUNT(a) FROM ForgotPasswordAttempt a WHERE a.ipAddress = :ipAddress AND a.createdAt >= :since")
    long countByIpAddressAndCreatedAtAfter(@Param("ipAddress") String ipAddress, @Param("since") Instant since);

    @Query("SELECT COUNT(a) FROM ForgotPasswordAttempt a WHERE a.emailHash = :emailHash AND a.createdAt >= :since")
    long countByEmailHashAndCreatedAtAfter(@Param("emailHash") String emailHash, @Param("since") Instant since);

    @Modifying
    @Query("DELETE FROM ForgotPasswordAttempt a WHERE a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
