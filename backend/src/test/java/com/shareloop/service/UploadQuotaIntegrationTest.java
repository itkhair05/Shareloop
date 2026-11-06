package com.shareloop.service;

import com.shareloop.config.UploadQuotaProperties;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.UploadQuotaExceededException;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class UploadQuotaIntegrationTest {

    private static final long QUOTA = 10L;

    @Autowired
    private UploadQuotaService uploadQuotaService;

    @Autowired
    private UploadQuotaProperties quotaProperties;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<User> owners = new ArrayList<>();

    @BeforeEach
    void setUp() {
        quotaProperties.setEnabled(true);
        quotaProperties.setUserPeriodBytes(QUOTA);
        quotaProperties.setUserPeriodHours(24);
    }

    @AfterEach
    void tearDown() {
        for (User owner : owners) {
            List<UploadedFile> owned = uploadedFileRepository.findAll().stream()
                    .filter(file -> file.getOwner().getId().equals(owner.getId()))
                    .toList();
            uploadedFileRepository.deleteAll(owned);
            userRepository.deleteById(owner.getId());
        }
        owners.clear();
        quotaProperties.setUserPeriodBytes(50L * 1024 * 1024);
        quotaProperties.setUserPeriodHours(24);
        quotaProperties.setEnabled(true);
    }

    private User newOwner() {
        User owner = userRepository.saveAndFlush(new User(
                "Quota Owner",
                "quota." + UUID.randomUUID() + "@example.com",
                "hash",
                UserRole.USER,
                UserStatus.ACTIVE));
        owners.add(owner);
        return owner;
    }

    private UploadedFile file(User owner, long sizeBytes) {
        return new UploadedFile(UUID.randomUUID(), UUID.randomUUID() + ".png", owner,
                "image/png", sizeBytes, UploadPurpose.CHAT);
    }

    private long usedBytes(User owner) {
        return uploadedFileRepository.sumSizeBytesByOwnerIdAndCreatedAtAfter(
                owner.getId(), Instant.now().minus(24, ChronoUnit.HOURS));
    }

    @Test
    @DisplayName("Allows uploads up to the exact byte quota and rejects the next one")
    void enforcesExactByteBoundary() {
        User owner = newOwner();

        assertThatCode(() -> uploadQuotaService.checkQuotaAndRegister(file(owner, 5))).doesNotThrowAnyException();
        assertThatCode(() -> uploadQuotaService.checkQuotaAndRegister(file(owner, 5))).doesNotThrowAnyException();

        assertThatThrownBy(() -> uploadQuotaService.checkQuotaAndRegister(file(owner, 1)))
                .isInstanceOf(UploadQuotaExceededException.class)
                .hasMessage(UploadQuotaService.QUOTA_EXCEEDED_MESSAGE);

        assertThat(usedBytes(owner)).isEqualTo(10);
    }

    @Test
    @DisplayName("Quota is isolated per owner")
    void isolatedPerOwner() {
        User first = newOwner();
        User second = newOwner();

        uploadQuotaService.checkQuotaAndRegister(file(first, 10));

        assertThatThrownBy(() -> uploadQuotaService.checkQuotaAndRegister(file(first, 1)))
                .isInstanceOf(UploadQuotaExceededException.class);
        assertThatCode(() -> uploadQuotaService.checkQuotaAndRegister(file(second, 10)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Files pending deletion still count until their row is removed")
    void pendingDeletionStillCounts() {
        User owner = newOwner();
        UploadedFile pending = file(owner, 5);
        uploadQuotaService.checkQuotaAndRegister(pending);

        pending.markPendingDeletion(Instant.now());
        uploadedFileRepository.saveAndFlush(pending);

        assertThatThrownBy(() -> uploadQuotaService.checkQuotaAndRegister(file(owner, 6)))
                .isInstanceOf(UploadQuotaExceededException.class);
    }

    @Test
    @DisplayName("Files outside the rolling window do not count")
    void expiredFilesDoNotCount() {
        User owner = newOwner();
        UploadedFile old = file(owner, 10);
        uploadQuotaService.checkQuotaAndRegister(old);
        // created_at is immutable through JPA, so age the row with SQL.
        jdbcTemplate.update("UPDATE uploaded_files SET created_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minus(48, ChronoUnit.HOURS)), old.getId());

        assertThatCode(() -> uploadQuotaService.checkQuotaAndRegister(file(owner, 10)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Concurrent uploads cannot push one owner over quota")
    void concurrentUploadsCannotExceedQuota() throws Exception {
        User owner = newOwner();
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger rejectedCount = new AtomicInteger();
        AtomicInteger otherCount = new AtomicInteger();
        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);
                    uploadQuotaService.checkQuotaAndRegister(file(owner, 3));
                    successCount.incrementAndGet();
                } catch (UploadQuotaExceededException e) {
                    rejectedCount.incrementAndGet();
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).as("Unexpected failures").isZero();
        assertThat(successCount.get()).as("At most 3 files of 3 bytes fit in 10 bytes").isEqualTo(3);
        assertThat(rejectedCount.get()).isEqualTo(7);
        assertThat(usedBytes(owner)).isEqualTo(9);
    }
}
