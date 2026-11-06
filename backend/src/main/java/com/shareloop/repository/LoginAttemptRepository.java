package com.shareloop.repository;

import com.shareloop.entity.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, UUID> {

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1001, hashtext(:ipAddress))) sub", nativeQuery = true)
    Integer acquireAdvisoryLock(@Param("ipAddress") String ipAddress);

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1005, hashtext(:accountKey))) sub", nativeQuery = true)
    Integer acquireAccountAdvisoryLock(@Param("accountKey") String accountKey);

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(1006, hashtext(:registrationKey))) sub", nativeQuery = true)
    Integer acquireRegistrationAdvisoryLock(@Param("registrationKey") String registrationKey);

    @Query("SELECT COUNT(a) FROM LoginAttempt a WHERE a.ipAddress = :ipAddress AND a.createdAt >= :since")
    long countByIpAddressAndCreatedAtAfter(@Param("ipAddress") String ipAddress, @Param("since") Instant since);

    @Modifying
    @Query("DELETE FROM LoginAttempt a WHERE a.ipAddress = :key")
    int deleteByIpAddress(@Param("key") String key);

    @Modifying
    @Query("DELETE FROM LoginAttempt a WHERE a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
