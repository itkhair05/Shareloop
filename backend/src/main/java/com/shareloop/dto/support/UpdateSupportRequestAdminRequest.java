package com.shareloop.dto.support;

import com.shareloop.entity.enums.SupportRequestStatus;
import jakarta.validation.constraints.Size;

public class UpdateSupportRequestAdminRequest {

    private SupportRequestStatus status;

    @Size(max = 2000, message = "Admin response must not exceed 2000 characters")
    private String adminResponse;

    @Size(max = 2000, message = "Admin notes must not exceed 2000 characters")
    private String adminNotes;

    public UpdateSupportRequestAdminRequest() {
    }

    public UpdateSupportRequestAdminRequest(SupportRequestStatus status, String adminResponse, String adminNotes) {
        this.status = status;
        this.adminResponse = adminResponse;
        this.adminNotes = adminNotes;
    }

    public SupportRequestStatus getStatus() {
        return status;
    }

    public void setStatus(SupportRequestStatus status) {
        this.status = status;
    }

    public String getAdminResponse() {
        return adminResponse;
    }

    public void setAdminResponse(String adminResponse) {
        this.adminResponse = adminResponse;
    }

    public String getAdminNotes() {
        return adminNotes;
    }

    public void setAdminNotes(String adminNotes) {
        this.adminNotes = adminNotes;
    }
}
