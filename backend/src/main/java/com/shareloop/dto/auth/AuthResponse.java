package com.shareloop.dto.auth;

import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;

import java.time.Instant;
import java.util.UUID;

public class AuthResponse {

    private UUID id;
    private String displayName;
    private String email;
    private UserRole role;
    private UserStatus status;
    private Instant createdAt;
    private String accessToken;
    private String tokenType = "Bearer";

    public AuthResponse() {
    }

    public AuthResponse(UUID id, String displayName, String email, UserRole role, UserStatus status, Instant createdAt, String accessToken) {
        this.id = id;
        this.displayName = displayName;
        this.email = email;
        this.role = role;
        this.status = status;
        this.createdAt = createdAt;
        this.accessToken = accessToken;
        this.tokenType = "Bearer";
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }
}
