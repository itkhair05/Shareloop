package com.shareloop.exception;

/**
 * Thrown when Google Sign-In is invoked but is disabled or unconfigured on the server.
 */
public class GoogleAuthConfigurationException extends RuntimeException {

    public GoogleAuthConfigurationException(String message) {
        super(message);
    }

    public GoogleAuthConfigurationException(String message, Throwable cause) {
        super(message, cause);
    }
}
