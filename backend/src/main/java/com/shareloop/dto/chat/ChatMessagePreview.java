package com.shareloop.dto.chat;

import com.shareloop.entity.ChatMessage;

/**
 * Single source of truth for conversation previews so image-only messages never
 * render as empty conversations.
 */
public final class ChatMessagePreview {

    public static final String IMAGE_ONLY_PREVIEW = "[Hình ảnh]";

    private ChatMessagePreview() {
    }

    public static String from(ChatMessage message) {
        if (message == null) {
            return null;
        }
        String content = message.getContent();
        if (content != null && !content.isBlank()) {
            return content;
        }
        return message.getImageFileId() != null ? IMAGE_ONLY_PREVIEW : null;
    }
}
