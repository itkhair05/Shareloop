package com.shareloop.dto.attachment;

import java.util.UUID;

/**
 * Public reference to an attached image.
 *
 * Only the opaque file UUID and the domain-authorized retrieval URL are exposed;
 * internal storage paths and physical filenames never leave the backend.
 */
public class AttachmentResponse {

    private UUID id;
    private String url;

    public AttachmentResponse() {
    }

    public AttachmentResponse(UUID id, String url) {
        this.id = id;
        this.url = url;
    }

    public static AttachmentResponse reviewImage(UUID fileId) {
        return new AttachmentResponse(fileId, "/api/v1/review-images/" + fileId);
    }

    public static AttachmentResponse reportAttachment(UUID fileId) {
        return new AttachmentResponse(fileId, "/api/v1/reports/attachments/" + fileId);
    }

    public static AttachmentResponse supportRequestAttachment(UUID fileId) {
        return new AttachmentResponse(fileId, "/api/v1/support-requests/attachments/" + fileId);
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
