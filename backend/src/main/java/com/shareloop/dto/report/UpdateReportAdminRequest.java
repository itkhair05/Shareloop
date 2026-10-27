package com.shareloop.dto.report;

import com.shareloop.entity.enums.ReportStatus;
import jakarta.validation.constraints.Size;

public class UpdateReportAdminRequest {

    private ReportStatus status;

    @Size(max = 2000, message = "Resolution notes must not exceed 2000 characters")
    private String resolutionNotes;

    public UpdateReportAdminRequest() {
    }

    public UpdateReportAdminRequest(ReportStatus status, String resolutionNotes) {
        this.status = status;
        this.resolutionNotes = resolutionNotes;
    }

    public ReportStatus getStatus() {
        return status;
    }

    public void setStatus(ReportStatus status) {
        this.status = status;
    }

    public String getResolutionNotes() {
        return resolutionNotes;
    }

    public void setResolutionNotes(String resolutionNotes) {
        this.resolutionNotes = resolutionNotes;
    }
}
