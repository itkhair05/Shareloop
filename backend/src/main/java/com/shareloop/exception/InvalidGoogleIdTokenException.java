package com.shareloop.exception;

/**
 * Thrown when a Google ID Token fails verification (invalid signature, expired,
 * wrong audience or issuer, missing claims, or unverified email).
 */
public class InvalidGoogleIdTokenException extends RuntimeException {

    public InvalidGoogleIdTokenException(String message) {
        super(message);
    }

    public InvalidGoogleIdTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
