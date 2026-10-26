package com.shareloop.dto.user;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;

import java.time.Instant;
import java.util.UUID;

public class PublicUserProfileResponse {

    private UUID id;
    private String displayName;
    private UserRole role;
    private UserStatus status;
    private Instant createdAt;

    public PublicUserProfileResponse() {
    }

    public PublicUserProfileResponse(UUID id, String displayName, UserRole role, UserStatus status, Instant createdAt) {
        this.id = id;
        this.displayName = displayName;
        this.role = role;
        this.status = status;
        this.createdAt = createdAt;
    }

    public static PublicUserProfileResponse fromEntity(User user) {
        return new PublicUserProfileResponse(
                user.getId(),
                user.getDisplayName(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
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
}
