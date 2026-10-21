package com.shareloop.service;

import com.shareloop.dto.transaction.CancelTransactionRequest;
import com.shareloop.dto.transaction.TransactionResponse;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final ListingRepository listingRepository;
    private final ListingRequestRepository listingRequestRepository;
    private final UserRepository userRepository;

    public TransactionService(
            TransactionRepository transactionRepository,
            ListingRepository listingRepository,
            ListingRequestRepository listingRequestRepository,
            UserRepository userRepository
    ) {
        this.transactionRepository = transactionRepository;
        this.listingRepository = listingRepository;
        this.listingRequestRepository = listingRequestRepository;
        this.userRepository = userRepository;
    }

    /**
     * List transactions for the authenticated user with optional status and role filtering.
     * Non-admins see transactions where they are owner or requester.
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getUserTransactions(
            TransactionStatus status,
            String role,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view transactions");
        }

        validatePagination(page, size);

        Sort sort = Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Transaction> transactions;
        if ("owner".equalsIgnoreCase(role)) {
            transactions = transactionRepository.findByOwnerIdAndOptionalStatus(principal.getId(), status, pageable);
        } else if ("requester".equalsIgnoreCase(role)) {
            transactions = transactionRepository.findByRequesterIdAndOptionalStatus(principal.getId(), status, pageable);
        } else {
            transactions = transactionRepository.findByUserIdAndOptionalStatus(principal.getId(), status, pageable);
        }

        return transactions.map(t -> TransactionResponse.fromEntity(t, principal));
    }

    /**
     * Get transaction details by ID.
     * Authorized for owner, requester, or administrator.
     */
    @Transactional(readOnly = true)
    public TransactionResponse getTransactionDetails(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to access transaction details");
        }

        Transaction transaction = transactionRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));

        boolean isParticipant = transaction.isParticipant(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isParticipant && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view this transaction");
        }

        return TransactionResponse.fromEntity(transaction, principal);
    }

    /**
     * Get active or latest transaction for a listing.
     * Authorized for listing owner, accepted requester, or administrator.
     */
    @Transactional(readOnly = true)
    public TransactionResponse getListingTransaction(UUID listingId, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to access listing transaction");
        }

        listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        Transaction transaction = transactionRepository.findActiveByListingId(
                listingId,
                List.of(TransactionStatus.PENDING, TransactionStatus.IN_PROGRESS, TransactionStatus.COMPLETED)
        ).orElseGet(() -> {
            List<Transaction> allForListing = transactionRepository.findByListingId(listingId);
            if (allForListing.isEmpty()) {
                throw new ResourceNotFoundException("No transaction found for listing: " + listingId);
            }
            Transaction latest = allForListing.stream()
                    .max(Comparator.comparing(Transaction::getCreatedAt))
                    .orElseThrow();
            return transactionRepository.findWithDetailsById(latest.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + latest.getId()));
        });

        boolean isParticipant = transaction.isParticipant(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isParticipant && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view this transaction");
        }

        return TransactionResponse.fromEntity(transaction, principal);
    }

    /**
     * Confirm transaction completion.
     * Rules:
     * - Only participants (owner or requester) can confirm completion.
     * - Admins cannot force-complete a transaction.
     * - First confirmation sets flag and timestamp, transitioning status to IN_PROGRESS.
     * - Second confirmation sets flag and timestamp, transitioning status to COMPLETED and listing to COMPLETED.
     * - Repeated confirmation by the same participant is idempotent.
     * - CANCELLED transactions cannot be completed.
     */
    @Transactional
    public TransactionResponse completeTransaction(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to complete a transaction");
        }

        Transaction transaction = transactionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));

        boolean isOwner = transaction.isOwner(principal.getId());
        boolean isRequester = transaction.isRequester(principal.getId());
        if (!isOwner && !isRequester) {
            throw new AccessDeniedException("Only transaction participants may confirm completion");
        }

        if (transaction.getStatus() == TransactionStatus.CANCELLED) {
            throw new IllegalArgumentException("Cannot complete a cancelled transaction");
        }

        if (transaction.getStatus() == TransactionStatus.COMPLETED) {
            return TransactionResponse.fromEntity(transaction, principal);
        }

        if (isOwner && Boolean.TRUE.equals(transaction.getOwnerCompleted())) {
            return TransactionResponse.fromEntity(transaction, principal);
        }

        if (isRequester && Boolean.TRUE.equals(transaction.getRequesterCompleted())) {
            return TransactionResponse.fromEntity(transaction, principal);
        }

        Instant now = Instant.now();
        if (isOwner) {
            transaction.setOwnerCompleted(true);
            transaction.setOwnerCompletedAt(now);
        } else {
            transaction.setRequesterCompleted(true);
            transaction.setRequesterCompletedAt(now);
        }

        if (Boolean.TRUE.equals(transaction.getOwnerCompleted()) && Boolean.TRUE.equals(transaction.getRequesterCompleted())) {
            transaction.setStatus(TransactionStatus.COMPLETED);

            Listing listing = listingRepository.findByIdForUpdate(transaction.getListing().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + transaction.getListing().getId()));

            if (listing.getStatus() == ListingStatus.RESERVED) {
                listing.setStatus(ListingStatus.COMPLETED);
                listingRepository.saveAndFlush(listing);
            }
        } else {
            transaction.setStatus(TransactionStatus.IN_PROGRESS);
        }

        Transaction saved = transactionRepository.saveAndFlush(transaction);
        return TransactionResponse.fromEntity(saved, principal);
    }

    /**
     * Cancel an ongoing transaction.
     * Rules:
     * - Authorized for owner, requester, or administrator.
     * - COMPLETED and CANCELLED are terminal states and cannot be cancelled.
     * - Admins must provide a mandatory non-empty cancellation reason.
     * - Atomically sets transaction to CANCELLED, linked request to CANCELLED, and listing back to ACTIVE (if RESERVED).
     */
    @Transactional
    public TransactionResponse cancelTransaction(UUID id, CancelTransactionRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to cancel a transaction");
        }

        Transaction transaction = transactionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));

        boolean isOwner = transaction.isOwner(principal.getId());
        boolean isRequester = transaction.isRequester(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;

        if (!isOwner && !isRequester && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to cancel this transaction");
        }

        String reason = request != null && request.getReason() != null ? request.getReason().trim() : null;
        if (reason != null && reason.isEmpty()) {
            reason = null;
        }

        if (isAdmin && (reason == null || reason.isBlank())) {
            throw new IllegalArgumentException("Cancellation reason is mandatory for administrator cancellation");
        }

        if (reason != null && reason.length() > 500) {
            throw new IllegalArgumentException("Cancellation reason must not exceed 500 characters");
        }

        if (transaction.getStatus() == TransactionStatus.COMPLETED) {
            throw new IllegalArgumentException("Cannot cancel a completed transaction");
        }

        if (transaction.getStatus() == TransactionStatus.CANCELLED) {
            throw new IllegalArgumentException("Transaction is already cancelled");
        }

        User cancellingUser = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        Instant now = Instant.now();
        transaction.setStatus(TransactionStatus.CANCELLED);
        transaction.setCancelledBy(cancellingUser);
        transaction.setCancelledAt(now);
        transaction.setCancellationReason(reason);

        // Save and flush transaction first so trigger prevent_accepted_request_mutation permits request update
        Transaction saved = transactionRepository.saveAndFlush(transaction);

        // Cancel the linked listing request
        ListingRequest listingRequest = transaction.getListingRequest();
        if (listingRequest != null) {
            listingRequest.setStatus(ListingRequestStatus.CANCELLED);
            listingRequestRepository.saveAndFlush(listingRequest);
        }

        // Restore listing to ACTIVE if and only if currently RESERVED
        Listing listing = listingRepository.findByIdForUpdate(transaction.getListing().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + transaction.getListing().getId()));

        if (listing.getStatus() == ListingStatus.RESERVED) {
            listing.setStatus(ListingStatus.ACTIVE);
            listingRepository.saveAndFlush(listing);
        }

        return TransactionResponse.fromEntity(saved, principal);
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 100) {
            throw new IllegalArgumentException("Page size must be between 1 and 100");
        }
    }
}
