package com.shareloop.dto.listing;

import com.shareloop.entity.User;

import java.util.UUID;

public class OwnerSummaryDto {

    private UUID id;
    private String displayName;
    private String avatarUrl;

    public OwnerSummaryDto() {
    }

    public OwnerSummaryDto(UUID id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }

    public OwnerSummaryDto(UUID id, String displayName, String avatarUrl) {
        this.id = id;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
    }

    public static OwnerSummaryDto fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return new OwnerSummaryDto(
                user.getId(),
                user.getDisplayName(),
                user.getEffectiveAvatarUrl()
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

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
