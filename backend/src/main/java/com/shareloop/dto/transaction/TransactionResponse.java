package com.shareloop.dto.transaction;

import com.shareloop.dto.chat.UserSummaryDto;
import com.shareloop.dto.request.ListingReferenceDto;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.security.UserPrincipal;

import java.time.Instant;
import java.util.UUID;

public class TransactionResponse {

    private UUID id;
    private ListingReferenceDto listing;
    private UUID listingRequestId;
    private UserSummaryDto owner;
    private UserSummaryDto requester;
    private TransactionStatus status;
    private Boolean ownerCompleted;
    private Boolean requesterCompleted;
    private Instant ownerCompletedAt;
    private Instant requesterCompletedAt;
    private String myRole;
    private Boolean myCompleted;
    private UserSummaryDto cancelledBy;
    private Instant cancelledAt;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;

    public TransactionResponse() {
    }

    public TransactionResponse(
            UUID id,
            ListingReferenceDto listing,
            UUID listingRequestId,
            UserSummaryDto owner,
            UserSummaryDto requester,
            TransactionStatus status,
            Boolean ownerCompleted,
            Boolean requesterCompleted,
            Instant ownerCompletedAt,
            Instant requesterCompletedAt,
            String myRole,
            Boolean myCompleted,
            UserSummaryDto cancelledBy,
            Instant cancelledAt,
            String cancellationReason,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.listing = listing;
        this.listingRequestId = listingRequestId;
        this.owner = owner;
        this.requester = requester;
        this.status = status;
        this.ownerCompleted = ownerCompleted;
        this.requesterCompleted = requesterCompleted;
        this.ownerCompletedAt = ownerCompletedAt;
        this.requesterCompletedAt = requesterCompletedAt;
        this.myRole = myRole;
        this.myCompleted = myCompleted;
        this.cancelledBy = cancelledBy;
        this.cancelledAt = cancelledAt;
        this.cancellationReason = cancellationReason;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static TransactionResponse fromEntity(Transaction transaction, UserPrincipal principal) {
        if (transaction == null) {
            return null;
        }

        UUID userId = principal != null ? principal.getId() : null;
        String role = "OTHER";
        Boolean userCompleted = null;

        if (userId != null) {
            if (transaction.isOwner(userId)) {
                role = "OWNER";
                userCompleted = transaction.getOwnerCompleted();
            } else if (transaction.isRequester(userId)) {
                role = "REQUESTER";
                userCompleted = transaction.getRequesterCompleted();
            } else if (principal.getRole() == UserRole.ADMIN) {
                role = "ADMIN";
            }
        }

        UUID reqId = transaction.getListingRequest() != null ? transaction.getListingRequest().getId() : null;
        UserSummaryDto cancelledByDto = transaction.getCancelledBy() != null ? UserSummaryDto.fromEntity(transaction.getCancelledBy()) : null;

        return new TransactionResponse(
                transaction.getId(),
                ListingReferenceDto.fromEntity(transaction.getListing()),
                reqId,
                UserSummaryDto.fromEntity(transaction.getOwner()),
                UserSummaryDto.fromEntity(transaction.getRequester()),
                transaction.getStatus(),
                transaction.getOwnerCompleted(),
                transaction.getRequesterCompleted(),
                transaction.getOwnerCompletedAt(),
                transaction.getRequesterCompletedAt(),
                role,
                userCompleted,
                cancelledByDto,
                transaction.getCancelledAt(),
                transaction.getCancellationReason(),
                transaction.getCreatedAt(),
                transaction.getUpdatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public ListingReferenceDto getListing() {
        return listing;
    }

    public void setListing(ListingReferenceDto listing) {
        this.listing = listing;
    }

    public UUID getListingRequestId() {
        return listingRequestId;
    }

    public void setListingRequestId(UUID listingRequestId) {
        this.listingRequestId = listingRequestId;
    }

    public UserSummaryDto getOwner() {
        return owner;
    }

    public void setOwner(UserSummaryDto owner) {
        this.owner = owner;
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

    public String getMyRole() {
        return myRole;
    }

    public void setMyRole(String myRole) {
        this.myRole = myRole;
    }

    public Boolean getMyCompleted() {
        return myCompleted;
    }

    public void setMyCompleted(Boolean myCompleted) {
        this.myCompleted = myCompleted;
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
