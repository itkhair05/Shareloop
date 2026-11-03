package com.shareloop.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionProofLabelsTest {

    @ParameterizedTest
    @CsvSource({
            "GIVEAWAY, Cho tặng",
            "SALE, Thanh lý",
            "WANTED, Cần tìm"
    })
    @DisplayName("Every actual ListingType value maps to a Vietnamese label")
    void mapsActualListingTypes(String raw, String expected) {
        assertThat(TransactionProofLabels.listingTypeLabel(raw)).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"EXCHANGE", "BORROW", "SELL", "giveaway", ""})
    @NullSource
    @DisplayName("Unknown or null listing type falls back to a safe Vietnamese label")
    void listingTypeFallback(String raw) {
        assertThat(TransactionProofLabels.listingTypeLabel(raw)).isEqualTo("Không xác định");
    }

    @ParameterizedTest
    @CsvSource({
            "PENDING, Đang chờ",
            "IN_PROGRESS, Đang thực hiện",
            "COMPLETED, Đã hoàn tất",
            "CANCELLED, Đã hủy"
    })
    @DisplayName("Every actual TransactionStatus value maps to a Vietnamese label")
    void mapsActualStatuses(String raw, String expected) {
        assertThat(TransactionProofLabels.transactionStatusLabel(raw)).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"REJECTED", "completed", ""})
    @NullSource
    @DisplayName("Unknown or null status falls back to a safe Vietnamese label")
    void statusFallback(String raw) {
        assertThat(TransactionProofLabels.transactionStatusLabel(raw)).isEqualTo("Không xác định");
    }

    @Test
    @DisplayName("Labels never equal raw enum names for mapped values")
    void labelsDifferFromRawNames() {
        assertThat(TransactionProofLabels.listingTypeLabel("GIVEAWAY")).isNotEqualTo("GIVEAWAY");
        assertThat(TransactionProofLabels.transactionStatusLabel("COMPLETED")).isNotEqualTo("COMPLETED");
    }
}
