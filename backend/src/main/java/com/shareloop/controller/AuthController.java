package com.shareloop.controller;

import com.shareloop.dto.auth.AuthResponse;
import com.shareloop.dto.auth.ChangePasswordRequest;
import com.shareloop.dto.auth.GoogleAccountStatusResponse;
import com.shareloop.dto.auth.GoogleLoginRequest;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.MessageResponse;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.dto.auth.SetPasswordRequest;
import com.shareloop.dto.auth.UpdateProfileRequest;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.exception.InvalidTokenException;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.AuthService;
import com.shareloop.security.ratelimit.ClientIpResolver;
import com.shareloop.security.ratelimit.LoginRateLimiter;
import com.shareloop.security.ratelimit.PasswordRateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
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
    private final ClientIpResolver clientIpResolver;
    private final LoginRateLimiter loginRateLimiter;
    private final PasswordRateLimiter passwordRateLimiter;

    public AuthController(
            AuthService authService,
            ClientIpResolver clientIpResolver,
            LoginRateLimiter loginRateLimiter,
            PasswordRateLimiter passwordRateLimiter
    ) {
        this.authService = authService;
        this.clientIpResolver = clientIpResolver;
        this.loginRateLimiter = loginRateLimiter;
        this.passwordRateLimiter = passwordRateLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String clientIp = clientIpResolver.resolveClientIp(httpRequest);
        loginRateLimiter.checkAndRecordAttempt(clientIp);
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(
            @Valid @RequestBody GoogleLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String clientIp = clientIpResolver.resolveClientIp(httpRequest);
        AuthResponse response = authService.loginWithGoogle(request, clientIp);
        return ResponseEntity.ok(response);
    }

    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/google/link")
    public ResponseEntity<GoogleAccountStatusResponse> linkGoogleAccount(
            @Valid @RequestBody GoogleLoginRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        GoogleAccountStatusResponse response = authService.linkGoogleAccount(principal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/google/status")
    public ResponseEntity<GoogleAccountStatusResponse> getGoogleAccountStatus(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        GoogleAccountStatusResponse response = authService.getGoogleAccountStatus(principal.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<com.shareloop.dto.auth.MessageResponse> forgotPassword(
            @Valid @RequestBody com.shareloop.dto.auth.ForgotPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        String clientIp = clientIpResolver.resolveClientIp(httpRequest);
        com.shareloop.dto.auth.MessageResponse response = authService.forgotPassword(request, clientIp);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<com.shareloop.dto.auth.MessageResponse> resetPassword(
            @Valid @RequestBody com.shareloop.dto.auth.ResetPasswordRequest request
    ) {
        com.shareloop.dto.auth.MessageResponse response = authService.resetPassword(request);
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

    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateCurrentUser(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        UserProfileResponse response = authService.updateCurrentUser(principal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Đổi mật khẩu người dùng đã xác thực", description = "Đổi mật khẩu hiện tại sang mật khẩu mới cho tài khoản đã có mật khẩu")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        String clientIp = clientIpResolver.resolveClientIp(httpRequest);
        passwordRateLimiter.checkChangePasswordRateLimit(principal.getId(), clientIp);
        MessageResponse response = authService.changePassword(principal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Thiết lập mật khẩu lần đầu", description = "Thiết lập mật khẩu khởi tạo cho tài khoản thuần Google (chưa có mật khẩu)")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/set-password")
    public ResponseEntity<MessageResponse> setPassword(
            @Valid @RequestBody SetPasswordRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        if (principal == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }
        String clientIp = clientIpResolver.resolveClientIp(httpRequest);
        passwordRateLimiter.checkSetPasswordRateLimit(principal.getId(), clientIp);
        MessageResponse response = authService.setPassword(principal.getId(), request);
        return ResponseEntity.ok(response);
    }
}
