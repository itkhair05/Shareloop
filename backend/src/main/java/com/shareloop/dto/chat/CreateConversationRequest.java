package com.shareloop.dto.chat;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public class CreateConversationRequest {

    @Size(max = 2000, message = "Initial message must not exceed 2000 characters")
    private String initialMessage;

    private UUID listingRequestId;

    public CreateConversationRequest() {
    }

    public CreateConversationRequest(String initialMessage) {
        this.initialMessage = initialMessage;
    }

    public CreateConversationRequest(String initialMessage, UUID listingRequestId) {
        this.initialMessage = initialMessage;
        this.listingRequestId = listingRequestId;
    }

    public String getInitialMessage() {
        return initialMessage;
    }

    public void setInitialMessage(String initialMessage) {
        this.initialMessage = initialMessage;
    }

    public UUID getListingRequestId() {
        return listingRequestId;
    }

    public void setListingRequestId(UUID listingRequestId) {
        this.listingRequestId = listingRequestId;
    }
}
