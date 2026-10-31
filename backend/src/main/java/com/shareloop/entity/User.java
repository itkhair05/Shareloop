package com.shareloop.entity;

import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "display_name", length = 100, nullable = false)
    private String displayName;

    @NotBlank
    @Email
    @Size(max = 255)
    @Column(name = "email", length = 255, nullable = false, unique = true)
    private String email;

    @Size(max = 30)
    @Column(name = "phone_number", length = 30)
    private String phoneNumber;

    @Size(max = 255)
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20, nullable = false)
    private UserRole role = UserRole.USER;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    @Size(max = 1024)
    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Size(max = 1024)
    @Column(name = "google_avatar_url", length = 1024)
    private String googleAvatarUrl;

    @Column(name = "avatar_updated_at")
    private Instant avatarUpdatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public User() {
    }

    public User(String displayName, String email, String passwordHash, UserRole role, UserStatus status) {
        this.displayName = displayName;
        this.email = email != null ? email.trim().toLowerCase(java.util.Locale.ROOT) : null;
        this.passwordHash = passwordHash;
        this.role = role != null ? role : UserRole.USER;
        this.status = status != null ? status : UserStatus.ACTIVE;
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
        this.email = email != null ? email.trim().toLowerCase(java.util.Locale.ROOT) : null;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
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

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getGoogleAvatarUrl() {
        return googleAvatarUrl;
    }

    public void setGoogleAvatarUrl(String googleAvatarUrl) {
        this.googleAvatarUrl = googleAvatarUrl;
    }

    public Instant getAvatarUpdatedAt() {
        return avatarUpdatedAt;
    }

    public void setAvatarUpdatedAt(Instant avatarUpdatedAt) {
        this.avatarUpdatedAt = avatarUpdatedAt;
    }

    /**
     * Resolves the effective avatar URL following priority rules:
     * 1. User-uploaded custom avatar (avatarUrl) if present and non-blank.
     * 2. Google OAuth profile avatar (googleAvatarUrl) if present and non-blank.
     * 3. null (fallback to initials/default on presentation layer).
     */
    @Transient
    public String getEffectiveAvatarUrl() {
        if (avatarUrl != null && !avatarUrl.isBlank()) {
            return avatarUrl;
        }
        if (googleAvatarUrl != null && !googleAvatarUrl.isBlank()) {
            return googleAvatarUrl;
        }
        return null;
    }

    /**
     * Updates the user's custom avatar and records the update timestamp.
     */
    public void updateCustomAvatar(String avatarUrl) {
        this.avatarUrl = avatarUrl;
        this.avatarUpdatedAt = Instant.now();
    }

    /**
     * Clears the user's custom avatar and records the update timestamp.
     * Leaves googleAvatarUrl untouched.
     */
    public void clearCustomAvatar() {
        this.avatarUrl = null;
        this.avatarUpdatedAt = Instant.now();
    }

    /**
     * Synchronizes the verified Google profile picture URL.
     * - Preserves the existing Google avatar if the new picture URL is null or blank.
     * - Leaves the custom avatar (avatarUrl) and avatarUpdatedAt untouched.
     *
     * @param pictureUrl verified Google profile picture URL
     * @return true if the Google avatar URL was modified, false otherwise
     */
    public boolean syncGoogleAvatar(String pictureUrl) {
        if (pictureUrl != null && !pictureUrl.isBlank()) {
            String trimmed = pictureUrl.trim();
            if (!Objects.equals(this.googleAvatarUrl, trimmed)) {
                this.googleAvatarUrl = trimmed;
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return id != null && Objects.equals(id, user.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", displayName='" + displayName + '\'' +
                ", email='" + email + '\'' +
                ", phoneNumber='" + phoneNumber + '\'' +
                ", role=" + role +
                ", status=" + status +
                ", avatarUrl='" + avatarUrl + '\'' +
                ", googleAvatarUrl='" + googleAvatarUrl + '\'' +
                ", avatarUpdatedAt=" + avatarUpdatedAt +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}
