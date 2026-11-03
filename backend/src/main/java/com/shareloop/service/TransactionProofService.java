package com.shareloop.service;

import com.shareloop.entity.Category;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.TransactionNotCompletedException;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.security.UserPrincipal;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Generates transaction proof PDF documents on demand for completed
 * transactions. Available to the two transaction participants and admins.
 */
@Service
public class TransactionProofService {

    private final TransactionRepository transactionRepository;
    private final TransactionProofPdfRenderer pdfRenderer;

    public TransactionProofService(TransactionRepository transactionRepository,
                                   TransactionProofPdfRenderer pdfRenderer) {
        this.transactionRepository = transactionRepository;
        this.pdfRenderer = pdfRenderer;
    }

    @Transactional(readOnly = true)
    public byte[] generateProof(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to download transaction proof");
        }

        Transaction transaction = transactionRepository.findWithProofDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));

        boolean isParticipant = transaction.isParticipant(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isParticipant && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to download transaction proof");
        }

        if (transaction.getStatus() != TransactionStatus.COMPLETED) {
            throw new TransactionNotCompletedException(
                    "Giao dịch chưa hoàn tất nên chưa thể tải tài liệu xác nhận.");
        }

        return pdfRenderer.render(buildProofData(transaction));
    }

    TransactionProofData buildProofData(Transaction transaction) {
        Category category = transaction.getListing().getCategory();
        return new TransactionProofData(
                transaction.getId(),
                transaction.getCreatedAt(),
                transaction.getStatus().name(),
                transaction.getOwner().getDisplayName(),
                transaction.getRequester().getDisplayName(),
                transaction.getListing().getId(),
                transaction.getListing().getTitle(),
                transaction.getListing().getListingType().name(),
                category != null ? category.getName() : null,
                transaction.getOwnerCompletedAt(),
                transaction.getRequesterCompletedAt(),
                completionTimestamp(transaction.getOwnerCompletedAt(), transaction.getRequesterCompletedAt()),
                Instant.now()
        );
    }

    static Instant completionTimestamp(Instant ownerCompletedAt, Instant requesterCompletedAt) {
        if (ownerCompletedAt == null) {
            return requesterCompletedAt;
        }
        if (requesterCompletedAt == null) {
            return ownerCompletedAt;
        }
        return ownerCompletedAt.isAfter(requesterCompletedAt) ? ownerCompletedAt : requesterCompletedAt;
    }
}
