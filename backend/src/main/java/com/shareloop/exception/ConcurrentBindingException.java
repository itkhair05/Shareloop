package com.shareloop.exception;

/**
 * Raised when a file binding cannot be completed because of a concurrent
 * database lock conflict (for example a PostgreSQL deadlock). The transaction
 * is rolled back and the caller may retry the whole operation.
 */
public class ConcurrentBindingException extends RuntimeException {

    public ConcurrentBindingException(String message) {
        super(message);
    }

    public ConcurrentBindingException(String message, Throwable cause) {
        super(message, cause);
    }
}
