package com.shareloop.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionProofPdfRendererTest {

    private static final String FULL_DISCLAIMER =
            "Tài liệu được tạo tự động từ dữ liệu hệ thống ShareLoop. Tài liệu ghi nhận việc hai bên đã xác nhận hoàn tất giao dịch trên nền tảng. "
                    + "Đây không phải hợp đồng pháp lý, hóa đơn, biên lai hoặc chứng từ thuế. "
                    + "ShareLoop không xác minh độc lập danh tính thực tế của các bên, việc thanh toán, bàn giao vật phẩm, chất lượng vật phẩm hoặc quyền sở hữu.";

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
    @DisplayName("Extracted text contains localized fields with correct Vietnamese diacritics and no raw enum names")
    void rendersExpectedVietnameseContent() throws Exception {
        byte[] pdf = renderer.render(sampleData("Đặng Thị Hồng Ân", "Nguyễn Văn Đức", "Bàn học gỗ sồi", "Đồ nội thất"));
        String text = extractText(pdf);

        assertThat(text).contains("ShareLoop");
        assertThat(text).contains("BIÊN NHẬN GIAO DỊCH");
        assertThat(text).contains("ĐÃ HOÀN TẤT");
        assertThat(text).contains("3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101");
        assertThat(text).contains("7b4b5f0c-11a2-4c7b-8e3d-2c4a1f0b0102");
        assertThat(text).contains("Đặng Thị Hồng Ân");
        assertThat(text).contains("Nguyễn Văn Đức");
        assertThat(text).contains("Bàn học gỗ sồi");
        assertThat(text).contains("Cho tặng");
        assertThat(text).contains("Đồ nội thất");
        assertThat(text).contains("Đã hoàn tất");
        assertThat(text).contains("01/11/2026 17:00:00 (GMT+7)");
        // Completion timestamp is the later of the two confirmation timestamps.
        assertThat(text).contains("03/11/2026 16:15:10 (GMT+7)");
        assertThat(text).contains("Tài liệu được tạo lúc: 03/11/2026 17:05:00 (GMT+7)");
        assertThat(text).contains("Trang 1/1");
        assertThat(text).contains("CHỦ BÀI ĐĂNG");
        assertThat(text).contains("NGƯỜI NHẬN");
        assertThat(text).contains("Đã xác nhận lúc");
        assertThat(text.replaceAll("\\s+", " ")).contains(FULL_DISCLAIMER);
        assertThat(text).contains("THÔNG TIN BÀI ĐĂNG (DỮ LIỆU HIỆN TẠI)");

        // Raw enum names must never reach the user.
        assertThat(text).doesNotContain("GIVEAWAY");
        assertThat(text).doesNotContain("COMPLETED");
    }

    @Test
    @DisplayName("Section headings appear in the specified order")
    void rendersSectionsInOrder() throws Exception {
        byte[] pdf = renderer.render(sampleData("Alice", "Bob", "Bàn làm việc", "Danh mục"));
        String text = extractText(pdf);

        int section1 = text.indexOf("THÔNG TIN GIAO DỊCH");
        int section2 = text.indexOf("XÁC NHẬN CỦA HAI BÊN");
        int section3 = text.indexOf("THÔNG TIN BÀI ĐĂNG (DỮ LIỆU HIỆN TẠI)");
        int section4 = text.indexOf("GHI CHÚ");

        assertThat(section1).isGreaterThanOrEqualTo(0);
        assertThat(section2).isGreaterThan(section1);
        assertThat(section3).isGreaterThan(section2);
        assertThat(section4).isGreaterThan(section3);
    }

    @Test
    @DisplayName("Non-completed status and non-giveaway listing type render localized labels only")
    void rendersOtherEnumValuesLocalized() throws Exception {
        TransactionProofData data = new TransactionProofData(
                UUID.fromString("3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101"),
                Instant.parse("2026-11-01T10:00:00Z"),
                "IN_PROGRESS",
                "Alice",
                "Bob",
                UUID.fromString("7b4b5f0c-11a2-4c7b-8e3d-2c4a1f0b0102"),
                "Bàn làm việc",
                "SALE",
                "Danh mục",
                Instant.parse("2026-11-03T08:30:45Z"),
                null,
                Instant.parse("2026-11-03T08:30:45Z"),
                Instant.parse("2026-11-03T10:05:00Z")
        );

        String text = extractText(renderer.render(data));

        assertThat(text).contains("Đang thực hiện");
        assertThat(text).contains("Thanh lý");
        assertThat(text).contains("Chưa xác nhận");
        assertThat(text).doesNotContain("IN_PROGRESS");
        assertThat(text).doesNotContain("SALE");
    }

    @Test
    @DisplayName("Unknown enum values fall back to a safe Vietnamese label")
    void rendersUnknownEnumFallback() throws Exception {
        TransactionProofData data = new TransactionProofData(
                UUID.fromString("3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101"),
                Instant.parse("2026-11-01T10:00:00Z"),
                "ARCHIVED",
                "Alice",
                "Bob",
                UUID.fromString("7b4b5f0c-11a2-4c7b-8e3d-2c4a1f0b0102"),
                "Bàn làm việc",
                "RENT",
                "Danh mục",
                Instant.parse("2026-11-03T08:30:45Z"),
                Instant.parse("2026-11-03T09:15:10Z"),
                Instant.parse("2026-11-03T09:15:10Z"),
                Instant.parse("2026-11-03T10:05:00Z")
        );

        String text = extractText(renderer.render(data));

        assertThat(text).contains("Không xác định");
        assertThat(text).doesNotContain("ARCHIVED");
        assertThat(text).doesNotContain("RENT");
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

    @Test
    @DisplayName("Multi-page footer stamping numbers every page correctly")
    void stampsFootersOnEveryPage() throws Exception {
        ProofFontProvider fontProvider = new ProofFontProvider();
        byte[] stamped;
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDType0Font regular = PDType0Font.load(
                    document, new ByteArrayInputStream(fontProvider.getRegularFontBytes()), true);
            for (int i = 0; i < 3; i++) {
                document.addPage(new PDPage(org.apache.pdfbox.pdmodel.common.PDRectangle.A4));
            }
            TransactionProofPdfRenderer.stampFooters(document, regular, Instant.parse("2026-11-03T10:05:00Z"));
            document.save(output);
            stamped = output.toByteArray();
        }

        try (PDDocument document = Loader.loadPDF(stamped)) {
            assertThat(document.getNumberOfPages()).isEqualTo(3);
            PDFTextStripper stripper = new PDFTextStripper();
            for (int i = 1; i <= 3; i++) {
                stripper.setStartPage(i);
                stripper.setEndPage(i);
                String pageText = stripper.getText(document);
                assertThat(pageText).contains("Tài liệu được tạo lúc: 03/11/2026 17:05:00 (GMT+7)");
                assertThat(pageText).contains("Trang " + i + "/3");
            }
        }
    }

    @Test
    @DisplayName("Rendered page rasterizes to a non-blank PNG for visual inspection")
    void rendersNonBlankRaster() throws Exception {
        byte[] pdf = renderer.render(sampleData("Đặng Thị Hồng Ân", "Nguyễn Văn Đức", "Bàn học gỗ sồi", "Đồ nội thất"));

        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            var image = pdfRenderer.renderImageWithDPI(0, 96);
            assertThat(image.getWidth()).isGreaterThan(500);
            assertThat(image.getHeight()).isGreaterThan(700);

            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(image, "png", png);
            assertThat(png.size()).isGreaterThan(2000);

            Path debugDir = Path.of("target", "proof-png");
            Files.createDirectories(debugDir);
            Files.write(debugDir.resolve("transaction-proof-page-1.png"), png.toByteArray());
        }
    }
}
