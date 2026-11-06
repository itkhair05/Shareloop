package com.shareloop.exception;

/**
 * Raised when a user exceeds the rolling upload quota. The physical object is
 * removed before the exception escapes the upload service.
 */
public class UploadQuotaExceededException extends RuntimeException {

    public UploadQuotaExceededException(String message) {
        super(message);
    }
}
