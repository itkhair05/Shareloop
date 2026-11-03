package com.shareloop.service;

import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.TransactionNotCompletedException;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionProofServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private TransactionProofPdfRenderer pdfRenderer;

    private TransactionProofService proofService;

    private User owner;
    private User requester;
    private User admin;
    private User outsider;
    private Category category;
    private Listing listing;
    private Transaction transaction;

    @BeforeEach
    void setUp() {
        proofService = new TransactionProofService(transactionRepository, pdfRenderer);

        owner = new User("Alice Owner", "alice@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        owner.setId(UUID.randomUUID());
        requester = new User("Bob Requester", "bob@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        requester.setId(UUID.randomUUID());
        admin = new User("Dave Admin", "dave@example.com", "hash", UserRole.ADMIN, UserStatus.ACTIVE);
        admin.setId(UUID.randomUUID());
        outsider = new User("Charlie Outsider", "charlie@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        outsider.setId(UUID.randomUUID());

        category = new Category("Đồ nội thất", "noi-that", "desc", true);
        category.setId(UUID.randomUUID());
        listing = new Listing(owner, category, ListingType.GIVEAWAY, "Bàn học gỗ sồi", "Mô tả", "Hanoi");
        listing.setId(UUID.randomUUID());

        ListingRequest request = new ListingRequest(listing, requester, "Tôi cần chiếc bàn này", ListingRequestStatus.ACCEPTED);
        transaction = new Transaction(request, listing, owner, requester, TransactionStatus.COMPLETED);
        transaction.setId(UUID.randomUUID());
        transaction.setCreatedAt(Instant.parse("2026-11-01T10:00:00Z"));
    }

    private UserPrincipal principal(User user) {
        return UserPrincipal.create(user);
    }

    private void stubCompletedTransaction() {
        when(transactionRepository.findWithProofDetailsById(transaction.getId()))
                .thenReturn(Optional.of(transaction));
    }

    @Test
    @DisplayName("Owner confirms first: completion timestamp uses the later requester timestamp")
    void ownerConfirmsFirstUsesLaterRequesterTimestamp() {
        Instant ownerAt = Instant.parse("2026-11-03T08:30:45Z");
        Instant requesterAt = Instant.parse("2026-11-03T09:15:10Z");
        transaction.setOwnerCompletedAt(ownerAt);
        transaction.setRequesterCompletedAt(requesterAt);
        stubCompletedTransaction();
        when(pdfRenderer.render(any())).thenReturn(new byte[]{'%', 'P', 'D', 'F', '-'});

        proofService.generateProof(transaction.getId(), principal(owner));

        ArgumentCaptor<TransactionProofData> captor = ArgumentCaptor.forClass(TransactionProofData.class);
        verify(pdfRenderer).render(captor.capture());
        assertThat(captor.getValue().completionAt()).isEqualTo(requesterAt);
        assertThat(captor.getValue().completionAt()).isNotEqualTo(transaction.getUpdatedAt());
    }

    @Test
    @DisplayName("Requester confirms first: completion timestamp uses the later owner timestamp")
    void requesterConfirmsFirstUsesLaterOwnerTimestamp() {
        Instant requesterAt = Instant.parse("2026-11-03T08:30:45Z");
        Instant ownerAt = Instant.parse("2026-11-03T09:15:10Z");
        transaction.setOwnerCompletedAt(ownerAt);
        transaction.setRequesterCompletedAt(requesterAt);
        stubCompletedTransaction();
        when(pdfRenderer.render(any())).thenReturn(new byte[0]);

        proofService.generateProof(transaction.getId(), principal(requester));

        ArgumentCaptor<TransactionProofData> captor = ArgumentCaptor.forClass(TransactionProofData.class);
        verify(pdfRenderer).render(captor.capture());
        assertThat(captor.getValue().completionAt()).isEqualTo(ownerAt);
    }

    @Test
    @DisplayName("Proof data excludes email/phone and includes only approved fields")
    void proofDataContainsOnlyApprovedFields() {
        transaction.setOwnerCompletedAt(Instant.parse("2026-11-03T08:30:45Z"));
        transaction.setRequesterCompletedAt(Instant.parse("2026-11-03T09:15:10Z"));
        stubCompletedTransaction();
        when(pdfRenderer.render(any())).thenReturn(new byte[0]);

        proofService.generateProof(transaction.getId(), principal(admin));

        ArgumentCaptor<TransactionProofData> captor = ArgumentCaptor.forClass(TransactionProofData.class);
        verify(pdfRenderer).render(captor.capture());
        TransactionProofData data = captor.getValue();
        assertThat(data.transactionId()).isEqualTo(transaction.getId());
        assertThat(data.ownerDisplayName()).isEqualTo("Alice Owner");
        assertThat(data.requesterDisplayName()).isEqualTo("Bob Requester");
        assertThat(data.listingTitle()).isEqualTo("Bàn học gỗ sồi");
        assertThat(data.listingType()).isEqualTo("GIVEAWAY");
        assertThat(data.listingCategory()).isEqualTo("Đồ nội thất");
        assertThat(data.transactionStatus()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("Null principal is rejected with AccessDeniedException")
    void nullPrincipalIsRejected() {
        assertThatThrownBy(() -> proofService.generateProof(transaction.getId(), null))
                .isInstanceOf(AccessDeniedException.class);
        verify(transactionRepository, never()).findWithProofDetailsById(any());
    }

    @Test
    @DisplayName("Missing transaction returns 404 via ResourceNotFoundException")
    void missingTransactionReturns404() {
        when(transactionRepository.findWithProofDetailsById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> proofService.generateProof(UUID.randomUUID(), principal(owner)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("Unrelated authenticated user is rejected with AccessDeniedException")
    void outsiderIsRejected() {
        stubCompletedTransaction();

        assertThatThrownBy(() -> proofService.generateProof(transaction.getId(), principal(outsider)))
                .isInstanceOf(AccessDeniedException.class);
        verify(pdfRenderer, never()).render(any());
    }

    @Test
    @DisplayName("PENDING, IN_PROGRESS and CANCELLED transactions are rejected with TransactionNotCompletedException")
    void nonCompletedTransactionsAreRejected() {
        for (TransactionStatus status : new TransactionStatus[]{
                TransactionStatus.PENDING, TransactionStatus.IN_PROGRESS, TransactionStatus.CANCELLED}) {
            transaction.setStatus(status);
            stubCompletedTransaction();

            assertThatThrownBy(() -> proofService.generateProof(transaction.getId(), principal(owner)))
                    .isInstanceOf(TransactionNotCompletedException.class)
                    .hasMessageContaining("chưa hoàn tất");
            verify(pdfRenderer, never()).render(any());
        }
    }

    @Test
    @DisplayName("completionTimestamp is null-safe and always returns the later timestamp")
    void completionTimestampUsesLaterValue() {
        Instant earlier = Instant.parse("2026-11-03T08:30:45Z");
        Instant later = Instant.parse("2026-11-03T09:15:10Z");

        assertThat(TransactionProofService.completionTimestamp(earlier, later)).isEqualTo(later);
        assertThat(TransactionProofService.completionTimestamp(later, earlier)).isEqualTo(later);
        assertThat(TransactionProofService.completionTimestamp(earlier, earlier)).isEqualTo(earlier);
        assertThat(TransactionProofService.completionTimestamp(null, later)).isEqualTo(later);
        assertThat(TransactionProofService.completionTimestamp(earlier, null)).isEqualTo(earlier);
        assertThat(TransactionProofService.completionTimestamp(null, null)).isNull();
    }
}
