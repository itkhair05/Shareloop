package com.shareloop.exception;

public class AccountLinkingRequiredException extends RuntimeException {
    public AccountLinkingRequiredException(String message) {
        super(message);
    }
}
