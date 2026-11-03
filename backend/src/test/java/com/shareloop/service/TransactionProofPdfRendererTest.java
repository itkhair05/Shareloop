package com.shareloop.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionProofPdfRendererTest {

    private TransactionProofPdfRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new TransactionProofPdfRenderer(new ProofFontProvider());
    }

    private TransactionProofData sampleData(String ownerName, String requesterName, String title, String category) {
        Instant ownerAt = Instant.parse("2026-11-03T08:30:45Z");
        Instant requesterAt = Instant.parse("2026-11-03T09:15:10Z");
        return new TransactionProofData(
                UUID.fromString("3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101"),
                Instant.parse("2026-11-01T10:00:00Z"),
                "COMPLETED",
                ownerName,
                requesterName,
                UUID.fromString("7b4b5f0c-11a2-4c7b-8e3d-2c4a1f0b0102"),
                title,
                "GIVEAWAY",
                category,
                ownerAt,
                requesterAt,
                TransactionProofService.completionTimestamp(ownerAt, requesterAt),
                Instant.parse("2026-11-03T10:05:00Z")
        );
    }

    private String extractText(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    @Test
    @DisplayName("Rendered PDF has PDF magic bytes, one page, and correct metadata")
    void rendersPdfStructure() throws Exception {
        byte[] pdf = renderer.render(sampleData("Đặng Thị Hồng Ân", "Nguyễn Văn Đức", "Bàn học gỗ sồi", "Đồ nội thất"));

        assertThat(pdf.length).isGreaterThan(500);
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");

        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            assertThat(document.getDocumentInformation().getTitle()).isEqualTo("ShareLoop Transaction Proof");
            assertThat(document.getDocumentInformation().getAuthor()).isEqualTo("ShareLoop");
            assertThat(document.getDocumentInformation().getCreator()).isEqualTo("ShareLoop");
            assertThat(document.getDocumentInformation().getProducer()).isEqualTo("ShareLoop");
        }
    }

    @Test
    @DisplayName("Extracted text contains expected fields with correct Vietnamese diacritics")
    void rendersExpectedVietnameseContent() throws Exception {
        byte[] pdf = renderer.render(sampleData("Đặng Thị Hồng Ân", "Nguyễn Văn Đức", "Bàn học gỗ sồi", "Đồ nội thất"));
        String text = extractText(pdf);

        assertThat(text).contains("SHARELOOP");
        assertThat(text).contains("XÁC NHẬN HOÀN TẤT GIAO DỊCH");
        assertThat(text).contains("3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101");
        assertThat(text).contains("7b4b5f0c-11a2-4c7b-8e3d-2c4a1f0b0102");
        assertThat(text).contains("Đặng Thị Hồng Ân");
        assertThat(text).contains("Nguyễn Văn Đức");
        assertThat(text).contains("Bàn học gỗ sồi");
        assertThat(text).contains("GIVEAWAY");
        assertThat(text).contains("Đồ nội thất");
        assertThat(text).contains("Đã hoàn tất");
        assertThat(text).contains("01/11/2026 17:00:00 (GMT+7)");
        // Completion timestamp is the later of the two confirmation timestamps.
        assertThat(text).contains("03/11/2026 16:15:10 (GMT+7)");
        assertThat(text).contains("Tài liệu được tạo lúc: 03/11/2026 17:05:00 (GMT+7)");
        assertThat(text).contains("Trang 1/1");
        assertThat(text).contains("không phải hợp đồng pháp lý");
        assertThat(text).contains("DỮ LIỆU HIỆN TẠI");
    }

    @Test
    @DisplayName("Missing category falls back to a neutral Vietnamese label")
    void rendersCategoryFallback() throws Exception {
        byte[] pdf = renderer.render(sampleData("Alice", "Bob", "Bàn làm việc", null));
        String text = extractText(pdf);

        assertThat(text).contains("Không xác định");
    }

    @Test
    @DisplayName("Long listing title and long names wrap without overflow or failure")
    void wrapsLongValues() throws Exception {
        String longTitle = "Ghế ".repeat(60).trim();
        String longName = "Nguyễn Văn ".repeat(12).trim();
        byte[] pdf = renderer.render(sampleData(longName, longName + " Hai", longTitle, "Danh mục"));
        String text = extractText(pdf);

        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        assertThat(text).contains("Trang");
    }

    @Test
    @DisplayName("Additional Vietnamese characters with stacked diacritics extract correctly")
    void rendersStackedDiacritics() throws Exception {
        byte[] pdf = renderer.render(sampleData("Lê Văn ậệỡừỹ", "Trần Thị ựồỗộ", "Đồ dùng ậệỡừỹ", "Danh mục"));
        String text = extractText(pdf);

        assertThat(text).contains("Lê Văn ậệỡừỹ");
        assertThat(text).contains("Trần Thị ựồỗộ");
        assertThat(text).contains("Đồ dùng ậệỡừỹ");
    }
}
