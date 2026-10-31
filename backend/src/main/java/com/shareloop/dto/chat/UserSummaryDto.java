package com.shareloop.dto.chat;

import com.shareloop.entity.User;

import java.util.UUID;

public class UserSummaryDto {

    private UUID id;
    private String displayName;
    private String avatarUrl;

    public UserSummaryDto() {
    }

    public UserSummaryDto(UUID id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }

    public UserSummaryDto(UUID id, String displayName, String avatarUrl) {
        this.id = id;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
    }

    public static UserSummaryDto fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return new UserSummaryDto(user.getId(), user.getDisplayName(), user.getEffectiveAvatarUrl());
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

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
