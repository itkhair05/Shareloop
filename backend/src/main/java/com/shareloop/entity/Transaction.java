package com.shareloop.entity;

import com.shareloop.entity.enums.TransactionStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_request_id", nullable = false, unique = true)
    private ListingRequest listingRequest;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private TransactionStatus status = TransactionStatus.PENDING;

    @NotNull
    @Column(name = "owner_completed", nullable = false)
    private Boolean ownerCompleted = false;

    @NotNull
    @Column(name = "requester_completed", nullable = false)
    private Boolean requesterCompleted = false;

    @Column(name = "owner_completed_at")
    private Instant ownerCompletedAt;

    @Column(name = "requester_completed_at")
    private Instant requesterCompletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
        if (status == null) {
            status = TransactionStatus.PENDING;
        }
        if (ownerCompleted == null) {
            ownerCompleted = false;
        }
        if (requesterCompleted == null) {
            requesterCompleted = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public Transaction() {
    }

    public Transaction(ListingRequest listingRequest, Listing listing, User owner, User requester, TransactionStatus status) {
        this.listingRequest = listingRequest;
        this.listing = listing;
        this.owner = owner;
        this.requester = requester;
        this.status = status != null ? status : TransactionStatus.PENDING;
        this.ownerCompleted = false;
        this.requesterCompleted = false;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public ListingRequest getListingRequest() {
        return listingRequest;
    }

    public void setListingRequest(ListingRequest listingRequest) {
        this.listingRequest = listingRequest;
    }

    public Listing getListing() {
        return listing;
    }

    public void setListing(Listing listing) {
        this.listing = listing;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public User getRequester() {
        return requester;
    }

    public void setRequester(User requester) {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Transaction that = (Transaction) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "Transaction{" +
                "id=" + id +
                ", status=" + status +
                ", ownerCompleted=" + ownerCompleted +
                ", requesterCompleted=" + requesterCompleted +
                ", ownerCompletedAt=" + ownerCompletedAt +
                ", requesterCompletedAt=" + requesterCompletedAt +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}
