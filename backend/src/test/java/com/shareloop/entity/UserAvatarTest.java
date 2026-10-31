package com.shareloop.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class UserAvatarTest {

    @Test
    @DisplayName("Both avatar fields NULL -> effective avatar is NULL")
    void effectiveAvatar_bothNull_returnsNull() {
        User user = new User();
        user.setAvatarUrl(null);
        user.setGoogleAvatarUrl(null);

        assertThat(user.getEffectiveAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("Only Google avatar exists -> returns Google avatar")
    void effectiveAvatar_onlyGoogleAvatar_returnsGoogleAvatar() {
        User user = new User();
        user.setAvatarUrl(null);
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar-123");

        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("https://lh3.googleusercontent.com/a/google-avatar-123");
    }

    @Test
    @DisplayName("Only custom avatar exists -> returns custom avatar")
    void effectiveAvatar_onlyCustomAvatar_returnsCustomAvatar() {
        User user = new User();
        user.setAvatarUrl("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");
        user.setGoogleAvatarUrl(null);

        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");
    }

    @Test
    @DisplayName("Both avatars exist -> custom avatar takes priority over Google avatar")
    void effectiveAvatar_bothExist_customAvatarTakesPriority() {
        User user = new User();
        user.setAvatarUrl("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.png");
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar-123");

        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.png");
    }

    @Test
    @DisplayName("Clearing custom avatar -> automatically falls back to Google avatar")
    void effectiveAvatar_clearingCustom_restoresGoogleAvatar() {
        User user = new User();
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar-123");
        user.setAvatarUrl("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");

        // Prior to deletion: custom
        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");

        // Action: User removes custom avatar
        user.setAvatarUrl(null);
        user.setAvatarUpdatedAt(Instant.now());

        // Result: Reverts to Google avatar
        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("https://lh3.googleusercontent.com/a/google-avatar-123");
    }

    @Test
    @DisplayName("Blank avatar strings are treated as empty -> fallback applies")
    void effectiveAvatar_blankStrings_handledGracefully() {
        User user = new User();
        user.setAvatarUrl("   ");
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar-123");

        assertThat(user.getEffectiveAvatarUrl())
                .isEqualTo("https://lh3.googleusercontent.com/a/google-avatar-123");

        user.setGoogleAvatarUrl("   ");
        assertThat(user.getEffectiveAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("Getters, setters, and avatarUpdatedAt timestamp work correctly")
    void avatarFields_gettersAndSetters_workAsExpected() {
        User user = new User();
        Instant now = Instant.now();

        user.setAvatarUrl("/api/v1/files/custom.jpg");
        user.setGoogleAvatarUrl("https://google.com/pic.jpg");
        user.setAvatarUpdatedAt(now);

        assertThat(user.getAvatarUrl()).isEqualTo("/api/v1/files/custom.jpg");
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://google.com/pic.jpg");
        assertThat(user.getAvatarUpdatedAt()).isEqualTo(now);
        assertThat(user.toString()).contains("avatarUrl='/api/v1/files/custom.jpg'");
    }

    @Test
    @DisplayName("updateCustomAvatar sets avatarUrl and updates timestamp")
    void updateCustomAvatar_setsUrlAndTimestamp() {
        User user = new User();
        user.updateCustomAvatar("/api/v1/files/new-avatar.png");

        assertThat(user.getAvatarUrl()).isEqualTo("/api/v1/files/new-avatar.png");
        assertThat(user.getAvatarUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("clearCustomAvatar sets avatarUrl to null, updates timestamp, preserves googleAvatarUrl")
    void clearCustomAvatar_clearsCustomAndPreservesGoogle() {
        User user = new User();
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/photo.jpg");
        user.updateCustomAvatar("/api/v1/files/old-avatar.png");

        user.clearCustomAvatar();

        assertThat(user.getAvatarUrl()).isNull();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/photo.jpg");
        assertThat(user.getEffectiveAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/photo.jpg");
        assertThat(user.getAvatarUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("syncGoogleAvatar updates URL when new picture is provided and differs")
    void syncGoogleAvatar_updatesWhenDifferent() {
        User user = new User();
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/old.jpg");

        boolean changed = user.syncGoogleAvatar("https://lh3.googleusercontent.com/new.jpg");

        assertThat(changed).isTrue();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/new.jpg");
    }

    @Test
    @DisplayName("syncGoogleAvatar returns false and does not change state when URL is identical")
    void syncGoogleAvatar_unchangedWhenIdentical() {
        User user = new User();
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/same.jpg");

        boolean changed = user.syncGoogleAvatar("https://lh3.googleusercontent.com/same.jpg");

        assertThat(changed).isFalse();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/same.jpg");
    }

    @Test
    @DisplayName("syncGoogleAvatar preserves existing Google avatar when new URL is null or blank")
    void syncGoogleAvatar_preservesExistingWhenNullOrBlank() {
        User user = new User();
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/existing.jpg");

        boolean changedNull = user.syncGoogleAvatar(null);
        assertThat(changedNull).isFalse();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/existing.jpg");

        boolean changedBlank = user.syncGoogleAvatar("   ");
        assertThat(changedBlank).isFalse();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/existing.jpg");
    }

    @Test
    @DisplayName("syncGoogleAvatar never overwrites custom avatar or modifies avatarUpdatedAt")
    void syncGoogleAvatar_neverOverwritesCustomAvatar() {
        User user = new User();
        user.updateCustomAvatar("/api/v1/files/custom.jpg");
        Instant customTimestamp = user.getAvatarUpdatedAt();

        user.syncGoogleAvatar("https://lh3.googleusercontent.com/new.jpg");

        assertThat(user.getAvatarUrl()).isEqualTo("/api/v1/files/custom.jpg");
        assertThat(user.getEffectiveAvatarUrl()).isEqualTo("/api/v1/files/custom.jpg");
        assertThat(user.getAvatarUpdatedAt()).isEqualTo(customTimestamp);
    }
}
