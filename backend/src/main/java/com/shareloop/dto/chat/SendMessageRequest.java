package com.shareloop.dto.chat;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public class SendMessageRequest {

    @Size(max = 2000, message = "Message content must not exceed 2000 characters")
    private String content;

    private UUID imageId;

    public SendMessageRequest() {
    }

    public SendMessageRequest(String content) {
        this.content = content;
    }

    public SendMessageRequest(String content, UUID imageId) {
        this.content = content;
        this.imageId = imageId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public UUID getImageId() {
        return imageId;
    }

    public void setImageId(UUID imageId) {
        this.imageId = imageId;
    }
}
