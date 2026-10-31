package com.shareloop.dto.request;

import com.shareloop.entity.User;

import java.util.UUID;

public class RequesterSummaryDto {

    private UUID id;
    private String displayName;
    private String avatarUrl;

    public RequesterSummaryDto() {
    }

    public RequesterSummaryDto(UUID id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }

    public RequesterSummaryDto(UUID id, String displayName, String avatarUrl) {
        this.id = id;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
    }

    public static RequesterSummaryDto fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return new RequesterSummaryDto(user.getId(), user.getDisplayName(), user.getEffectiveAvatarUrl());
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
