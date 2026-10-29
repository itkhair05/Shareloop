package com.shareloop.dto.transaction;

import com.shareloop.dto.chat.UserSummaryDto;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.enums.TransactionStatus;

import java.time.Instant;
import java.util.UUID;

public class AdminTransactionResponse {

    private UUID id;
    private UUID listingId;
    private String listingTitle;
    private UUID listingRequestId;
    private UUID ownerId;
    private String ownerDisplayName;
    private UserSummaryDto owner;
    private UUID requesterId;
    private String requesterDisplayName;
    private UserSummaryDto requester;
    private TransactionStatus status;
    private Boolean ownerCompleted;
    private Boolean requesterCompleted;
    private Instant ownerCompletedAt;
    private Instant requesterCompletedAt;
    private UUID cancelledById;
    private String cancelledByDisplayName;
    private UserSummaryDto cancelledBy;
    private Instant cancelledAt;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;

    public AdminTransactionResponse() {
    }

    public static AdminTransactionResponse fromEntity(Transaction transaction) {
        if (transaction == null) {
            return null;
        }

        AdminTransactionResponse response = new AdminTransactionResponse();
        response.setId(transaction.getId());

        if (transaction.getListing() != null) {
            response.setListingId(transaction.getListing().getId());
            response.setListingTitle(transaction.getListing().getTitle());
        }

        if (transaction.getListingRequest() != null) {
            response.setListingRequestId(transaction.getListingRequest().getId());
        }

        if (transaction.getOwner() != null) {
            response.setOwnerId(transaction.getOwner().getId());
            response.setOwnerDisplayName(transaction.getOwner().getDisplayName());
            response.setOwner(UserSummaryDto.fromEntity(transaction.getOwner()));
        }

        if (transaction.getRequester() != null) {
            response.setRequesterId(transaction.getRequester().getId());
            response.setRequesterDisplayName(transaction.getRequester().getDisplayName());
            response.setRequester(UserSummaryDto.fromEntity(transaction.getRequester()));
        }

        response.setStatus(transaction.getStatus());
        response.setOwnerCompleted(transaction.getOwnerCompleted());
        response.setRequesterCompleted(transaction.getRequesterCompleted());
        response.setOwnerCompletedAt(transaction.getOwnerCompletedAt());
        response.setRequesterCompletedAt(transaction.getRequesterCompletedAt());

        if (transaction.getCancelledBy() != null) {
            response.setCancelledById(transaction.getCancelledBy().getId());
            response.setCancelledByDisplayName(transaction.getCancelledBy().getDisplayName());
            response.setCancelledBy(UserSummaryDto.fromEntity(transaction.getCancelledBy()));
        }

        response.setCancelledAt(transaction.getCancelledAt());
        response.setCancellationReason(transaction.getCancellationReason());
        response.setCreatedAt(transaction.getCreatedAt());
        response.setUpdatedAt(transaction.getUpdatedAt());

        return response;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getListingId() {
        return listingId;
    }

    public void setListingId(UUID listingId) {
        this.listingId = listingId;
    }

    public String getListingTitle() {
        return listingTitle;
    }

    public void setListingTitle(String listingTitle) {
        this.listingTitle = listingTitle;
    }

    public UUID getListingRequestId() {
        return listingRequestId;
    }

    public void setListingRequestId(UUID listingRequestId) {
        this.listingRequestId = listingRequestId;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public String getOwnerDisplayName() {
        return ownerDisplayName;
    }

    public void setOwnerDisplayName(String ownerDisplayName) {
        this.ownerDisplayName = ownerDisplayName;
    }

    public UserSummaryDto getOwner() {
        return owner;
    }

    public void setOwner(UserSummaryDto owner) {
        this.owner = owner;
    }

    public UUID getRequesterId() {
        return requesterId;
    }

    public void setRequesterId(UUID requesterId) {
        this.requesterId = requesterId;
    }

    public String getRequesterDisplayName() {
        return requesterDisplayName;
    }

    public void setRequesterDisplayName(String requesterDisplayName) {
        this.requesterDisplayName = requesterDisplayName;
    }

    public UserSummaryDto getRequester() {
        return requester;
    }

    public void setRequester(UserSummaryDto requester) {
        this.requester = requester;
    }

    public TransactionStatus getStatus() {
        return status;
    }

    public void setStatus(TransactionStatus status) {
        this.status = status;
    }

    public Boolean getOwnerCompleted() {
        return ownerCompleted;
    }

    public void setOwnerCompleted(Boolean ownerCompleted) {
        this.ownerCompleted = ownerCompleted;
    }

    public Boolean getRequesterCompleted() {
        return requesterCompleted;
    }

    public void setRequesterCompleted(Boolean requesterCompleted) {
        this.requesterCompleted = requesterCompleted;
    }

    public Instant getOwnerCompletedAt() {
        return ownerCompletedAt;
    }

    public void setOwnerCompletedAt(Instant ownerCompletedAt) {
        this.ownerCompletedAt = ownerCompletedAt;
    }

    public Instant getRequesterCompletedAt() {
        return requesterCompletedAt;
    }

    public void setRequesterCompletedAt(Instant requesterCompletedAt) {
        this.requesterCompletedAt = requesterCompletedAt;
    }

    public UUID getCancelledById() {
        return cancelledById;
    }

    public void setCancelledById(UUID cancelledById) {
        this.cancelledById = cancelledById;
    }

    public String getCancelledByDisplayName() {
        return cancelledByDisplayName;
    }

    public void setCancelledByDisplayName(String cancelledByDisplayName) {
        this.cancelledByDisplayName = cancelledByDisplayName;
    }

    public UserSummaryDto getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(UserSummaryDto cancelledBy) {
        this.cancelledBy = cancelledBy;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(Instant cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void setCancellationReason(String cancellationReason) {
        this.cancellationReason = cancellationReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
