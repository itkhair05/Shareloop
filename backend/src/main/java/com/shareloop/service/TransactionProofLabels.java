package com.shareloop.service;

import java.util.Map;

/**
 * Vietnamese display labels for enum values shown on the transaction proof
 * document. Only values that exist in the actual enums are mapped; anything
 * unknown falls back to a safe Vietnamese label so raw enum names never reach
 * the user.
 */
final class TransactionProofLabels {

    private static final String UNKNOWN = "Không xác định";

    private static final Map<String, String> LISTING_TYPE_LABELS = Map.of(
            "GIVEAWAY", "Cho tặng",
            "SALE", "Thanh lý",
            "WANTED", "Cần tìm"
    );

    private static final Map<String, String> TRANSACTION_STATUS_LABELS = Map.of(
            "PENDING", "Đang chờ",
            "IN_PROGRESS", "Đang thực hiện",
            "COMPLETED", "Đã hoàn tất",
            "CANCELLED", "Đã hủy"
    );

    private TransactionProofLabels() {
    }

    static String listingTypeLabel(String listingType) {
        if (listingType == null) {
            return UNKNOWN;
        }
        return LISTING_TYPE_LABELS.getOrDefault(listingType, UNKNOWN);
    }

    static String transactionStatusLabel(String status) {
        if (status == null) {
            return UNKNOWN;
        }
        return TRANSACTION_STATUS_LABELS.getOrDefault(status, UNKNOWN);
    }
}
