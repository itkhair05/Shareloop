package com.shareloop.exception;

public class PasswordNotSetException extends RuntimeException {
    public PasswordNotSetException(String message) {
        super(message);
    }
}
