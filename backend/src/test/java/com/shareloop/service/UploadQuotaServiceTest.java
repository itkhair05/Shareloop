package com.shareloop.service;

import com.shareloop.config.UploadQuotaProperties;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.repository.UploadedFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UploadQuotaServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-06T10:00:00Z");
    private static final long QUOTA = 1000L;

    @Mock
    private UploadedFileRepository repository;

    private UploadQuotaProperties properties;
    private UploadQuotaService service;
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private User owner;

    @BeforeEach
    void setUp() {
        properties = new UploadQuotaProperties();
        properties.setEnabled(true);
        properties.setUserPeriodBytes(QUOTA);
        properties.setUserPeriodHours(24);
        service = new UploadQuotaService(repository, properties, clock);
        owner = new User("Owner", "owner@example.com", "hash",
                com.shareloop.entity.enums.UserRole.USER, com.shareloop.entity.enums.UserStatus.ACTIVE);
        owner.setId(UUID.randomUUID());
    }

    private UploadedFile file(long sizeBytes) {
        return new UploadedFile(UUID.randomUUID(), UUID.randomUUID() + ".png", owner,
                "image/png", sizeBytes, UploadPurpose.CHAT);
    }

    @Test
    @DisplayName("Registers the file when the quota has room")
    void registersWhenRoomAvailable() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(400L);

        UploadedFile registry = file(100);
        service.checkQuotaAndRegister(registry);

        verify(repository).acquireQuotaAdvisoryLock(owner.getId().toString());
        verify(repository).saveAndFlush(registry);
    }

    @Test
    @DisplayName("Allows a file that exactly fills the remaining quota")
    void allowsExactBoundary() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(600L);

        UploadedFile registry = file(400);
        service.checkQuotaAndRegister(registry);

        verify(repository).saveAndFlush(registry);
    }

    @Test
    @DisplayName("Rejects a file one byte over the remaining quota without saving it")
    void rejectsOneByteOver() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(600L);

        UploadedFile registry = file(401);

        assertThatThrownBy(() -> service.checkQuotaAndRegister(registry))
                .isInstanceOf(com.shareloop.exception.UploadQuotaExceededException.class)
                .hasMessage(UploadQuotaService.QUOTA_EXCEEDED_MESSAGE);

        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Rejects any upload when the user is already over quota")
    void rejectsWhenAlreadyOverQuota() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(QUOTA + 1);

        assertThatThrownBy(() -> service.checkQuotaAndRegister(file(1)))
                .isInstanceOf(com.shareloop.exception.UploadQuotaExceededException.class);

        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Queries the rolling window for the owner only")
    void queriesOwnerWindow() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(0L);

        service.checkQuotaAndRegister(file(10));

        ArgumentCaptor<Instant> since = ArgumentCaptor.forClass(Instant.class);
        verify(repository).sumSizeBytesByOwnerIdAndCreatedAtAfter(eq(owner.getId()), since.capture());
        assertThat(since.getValue()).isEqualTo(NOW.minusSeconds(24 * 3600));
    }

    @Test
    @DisplayName("Acquires the advisory lock before reading usage")
    void locksBeforeReading() {
        when(repository.sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any())).thenReturn(0L);

        service.checkQuotaAndRegister(file(10));

        InOrder order = inOrder(repository);
        order.verify(repository).acquireQuotaAdvisoryLock(owner.getId().toString());
        order.verify(repository).sumSizeBytesByOwnerIdAndCreatedAtAfter(eq(owner.getId()), any());
        order.verify(repository).saveAndFlush(any());
    }

    @Test
    @DisplayName("Disabled quota registers without a quota check")
    void disabledQuotaSkipsCheck() {
        properties.setEnabled(false);
        UploadedFile registry = file(10L * 1024 * 1024);

        service.checkQuotaAndRegister(registry);

        verify(repository).saveAndFlush(registry);
        verify(repository, never()).acquireQuotaAdvisoryLock(any());
        verify(repository, never()).sumSizeBytesByOwnerIdAndCreatedAtAfter(any(), any());
    }

    @Test
    @DisplayName("Invalid quota configuration fails at construction")
    void invalidConfigurationFailsFast() {
        UploadQuotaProperties invalid = new UploadQuotaProperties();
        invalid.setUserPeriodBytes(0);

        assertThatThrownBy(() -> new UploadQuotaService(repository, invalid, clock))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("positive");
    }
}
