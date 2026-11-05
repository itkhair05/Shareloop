package com.shareloop.exception;

/**
 * Raised when an attachment file is already bound or pending deletion, so the
 * domain record cannot take ownership of it. Maps to HTTP 409 Conflict.
 */
public class AttachmentConflictException extends RuntimeException {

    public AttachmentConflictException(String message) {
        super(message);
    }

    public AttachmentConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
