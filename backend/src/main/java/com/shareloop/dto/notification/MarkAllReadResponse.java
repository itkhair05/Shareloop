package com.shareloop.dto.notification;

public class MarkAllReadResponse {

    private int updatedCount;

    public MarkAllReadResponse() {
    }

    public MarkAllReadResponse(int updatedCount) {
        this.updatedCount = updatedCount;
    }

    public int getUpdatedCount() {
        return updatedCount;
    }

    public void setUpdatedCount(int updatedCount) {
        this.updatedCount = updatedCount;
    }
}
