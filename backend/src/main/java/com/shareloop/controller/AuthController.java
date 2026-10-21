package com.shareloop.controller;

import com.shareloop.dto.auth.AuthResponse;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.exception.InvalidTokenException;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.AuthService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Authentication", description = "User registration, login, and current user profile")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        UserProfileResponse response = authService.getCurrentUser(principal.getId());
        return ResponseEntity.ok(response);
    }
}
