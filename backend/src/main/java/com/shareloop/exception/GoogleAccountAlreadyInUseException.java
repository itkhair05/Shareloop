package com.shareloop.exception;

public class GoogleAccountAlreadyInUseException extends RuntimeException {
    public GoogleAccountAlreadyInUseException(String message) {
        super(message);
    }
}
