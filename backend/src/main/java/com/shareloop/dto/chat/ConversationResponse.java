package com.shareloop.dto.chat;

import com.shareloop.dto.request.ListingReferenceDto;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.User;

import java.time.Instant;
import java.util.UUID;

public class ConversationResponse {

    private UUID id;
    private ListingReferenceDto listing;
    private UserSummaryDto otherParticipant;
    private String lastMessagePreview;
    private Instant lastMessageAt;
    private UUID listingRequestId;
    private Instant createdAt;
    private Instant updatedAt;

    public ConversationResponse() {
    }

    public ConversationResponse(
            UUID id,
            ListingReferenceDto listing,
            UserSummaryDto otherParticipant,
            String lastMessagePreview,
            Instant lastMessageAt,
            UUID listingRequestId,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.listing = listing;
        this.otherParticipant = otherParticipant;
        this.lastMessagePreview = lastMessagePreview;
        this.lastMessageAt = lastMessageAt;
        this.listingRequestId = listingRequestId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static ConversationResponse fromEntity(Conversation conversation, UUID currentUserId, String lastMessagePreview) {
        if (conversation == null) {
            return null;
        }

        User other = conversation.getOtherParticipant(currentUserId);
        UserSummaryDto otherDto = UserSummaryDto.fromEntity(other);

        UUID reqId = conversation.getListingRequest() != null ? conversation.getListingRequest().getId() : null;

        return new ConversationResponse(
                conversation.getId(),
                ListingReferenceDto.fromEntity(conversation.getListing()),
                otherDto,
                lastMessagePreview,
                conversation.getLastMessageAt(),
                reqId,
                conversation.getCreatedAt(),
                conversation.getUpdatedAt()
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

    public UserSummaryDto getOtherParticipant() {
        return otherParticipant;
    }

    public void setOtherParticipant(UserSummaryDto otherParticipant) {
        this.otherParticipant = otherParticipant;
    }

    public String getLastMessagePreview() {
        return lastMessagePreview;
    }

    public void setLastMessagePreview(String lastMessagePreview) {
        this.lastMessagePreview = lastMessagePreview;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(Instant lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    public UUID getListingRequestId() {
        return listingRequestId;
    }

    public void setListingRequestId(UUID listingRequestId) {
        this.listingRequestId = listingRequestId;
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
