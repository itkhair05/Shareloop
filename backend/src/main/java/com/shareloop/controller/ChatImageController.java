package com.shareloop.controller;

import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ChatImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Chat", description = "Direct conversations, messaging between users, and unread counters")
@SecurityRequirement(name = "bearerAuth")
@RestController
public class ChatImageController {

    private final ChatImageService chatImageService;

    public ChatImageController(ChatImageService chatImageService) {
        this.chatImageService = chatImageService;
    }

    /**
     * Retrieve a private chat image. Only conversation participants are authorized.
     */
    @Operation(summary = "Retrieve chat image", description = "Private chat attachment retrieval restricted to conversation owner and requester.")
    @GetMapping("/api/v1/chat-images/{imageId}")
    public ResponseEntity<Resource> getChatImage(
            @PathVariable UUID imageId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ChatImageService.ChatImageResource image = chatImageService.loadImage(imageId, principal);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.filename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(image.resource());
    }
}
