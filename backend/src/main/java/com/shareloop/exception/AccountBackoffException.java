package com.shareloop.exception;

/**
 * Raised when an account has accumulated too many consecutive failed logins.
 * The response is identical for existing and non-existing accounts so callers
 * cannot use it to enumerate registered emails.
 */
public class AccountBackoffException extends RuntimeException {

    private final int retryAfterSeconds;

    public AccountBackoffException(String message, int retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
