package com.shareloop.exception;

public class TransactionNotCompletedException extends RuntimeException {

    public TransactionNotCompletedException(String message) {
        super(message);
    }
}
