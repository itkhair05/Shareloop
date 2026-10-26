package com.shareloop.controller;

import com.shareloop.dto.listing.ListingSummaryResponse;
import com.shareloop.dto.user.PublicUserProfileResponse;
import com.shareloop.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Users", description = "Public user profile and listings")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<PublicUserProfileResponse> getPublicUserProfile(@PathVariable UUID userId) {
        PublicUserProfileResponse response = userService.getPublicUserProfile(userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{userId}/listings")
    public ResponseEntity<Page<ListingSummaryResponse>> getUserActiveListings(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<ListingSummaryResponse> response = userService.getUserActiveListings(userId, page, size);
        return ResponseEntity.ok(response);
    }
}
