package com.shareloop.service;

import java.time.Instant;
import java.util.UUID;

/**
 * Display data for a transaction proof document. Contains only fields that are
 * allowed on the PDF; no email, phone, price, or other excluded personal data.
 */
public record TransactionProofData(
        UUID transactionId,
        Instant transactionCreatedAt,
        String transactionStatus,
        String ownerDisplayName,
        String requesterDisplayName,
        UUID listingId,
        String listingTitle,
        String listingType,
        String listingCategory,
        Instant ownerCompletedAt,
        Instant requesterCompletedAt,
        Instant completionAt,
        Instant generatedAt
) {
}
