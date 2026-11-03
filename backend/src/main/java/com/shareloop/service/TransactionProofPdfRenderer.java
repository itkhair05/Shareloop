package com.shareloop.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Renders an A4 transaction proof document in memory. Text is measured with
 * PDFBox font metrics and wrapped by words so Vietnamese content, long names,
 * and long titles never overflow the page.
 */
@Component
public class TransactionProofPdfRenderer {

    private static final PDRectangle PAGE_SIZE = PDRectangle.A4;

    private static final float MARGIN_X = 52f;
    private static final float MARGIN_TOP = 52f;
    private static final float MARGIN_BOTTOM = 58f;
    private static final float CONTENT_WIDTH = PAGE_SIZE.getWidth() - 2 * MARGIN_X;

    private static final float BRAND_SIZE = 12f;
    private static final float TITLE_SIZE = 17f;
    private static final float SECTION_SIZE = 11f;
    private static final float BODY_SIZE = 10f;
    private static final float SMALL_SIZE = 8.5f;
    private static final float FOOTER_SIZE = 7.5f;

    private static final float LINE_HEIGHT = 13.5f;
    private static final float SECTION_GAP = 14f;
    private static final float ROW_GAP = 4f;
    private static final float LABEL_WIDTH = 132f;
    private static final float FIELD_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;
    private static final int MAX_VALUE_LINES = 4;

    private static final ZoneId TIME_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(TIME_ZONE);

    private static final String UNKNOWN_CATEGORY = "Không xác định";
    private static final String DISCLAIMER =
            "Tài liệu được tạo tự động từ dữ liệu hệ thống ShareLoop. Tài liệu ghi nhận việc hai bên đã xác nhận hoàn tất giao dịch trên nền tảng. "
                    + "Đây không phải hợp đồng pháp lý, hóa đơn, biên lai hoặc chứng từ thuế. "
                    + "ShareLoop không xác minh độc lập danh tính thực tế của các bên, việc thanh toán, bàn giao vật phẩm, chất lượng vật phẩm hoặc quyền sở hữu.";

    private final ProofFontProvider fontProvider;

    public TransactionProofPdfRenderer(ProofFontProvider fontProvider) {
        this.fontProvider = fontProvider;
    }

    public byte[] render(TransactionProofData data) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDType0Font regular = PDType0Font.load(
                    document, new ByteArrayInputStream(fontProvider.getRegularFontBytes()), true);
            PDType0Font bold = PDType0Font.load(
                    document, new ByteArrayInputStream(fontProvider.getBoldFontBytes()), true);

            PDDocumentInformation information = document.getDocumentInformation();
            information.setTitle("ShareLoop Transaction Proof");
            information.setAuthor("ShareLoop");
            information.setCreator("ShareLoop");
            information.setProducer("ShareLoop");

            Layout layout = new Layout(document, regular, bold);
            try {
                drawDocument(layout, data);
            } finally {
                layout.close();
            }
            stampFooters(document, regular, data.generatedAt());

            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to render transaction proof PDF", ex);
        }
    }

    private void drawDocument(Layout layout, TransactionProofData data) throws IOException {
        layout.drawText(layout.bold, BRAND_SIZE, "SHARELOOP", MARGIN_X, layout.y);
        layout.moveDown(22f);
        layout.drawText(layout.bold, TITLE_SIZE, "XÁC NHẬN HOÀN TẤT GIAO DỊCH", MARGIN_X, layout.y);
        layout.moveDown(16f);
        layout.drawText(layout.regular, 9f, "Tài liệu được tạo tự động từ dữ liệu hệ thống ShareLoop", MARGIN_X, layout.y);
        layout.moveDown(10f);
        layout.drawRule(MARGIN_X, layout.y, CONTENT_WIDTH);

        drawSection(layout, "THÔNG TIN GIAO DỊCH");
        drawField(layout, "Mã giao dịch", data.transactionId().toString());
        drawField(layout, "Ngày tạo giao dịch", formatTimestamp(data.transactionCreatedAt()));
        drawField(layout, "Trạng thái giao dịch", statusLabel(data.transactionStatus()));
        drawField(layout, "Thời điểm hoàn tất", formatTimestamp(data.completionAt()));

        drawSection(layout, "XÁC NHẬN CỦA HAI BÊN");
        drawField(layout, "Chủ bài đăng", data.ownerDisplayName());
        drawField(layout, "Xác nhận lúc", formatTimestamp(data.ownerCompletedAt()));
        drawField(layout, "Người nhận", data.requesterDisplayName());
        drawField(layout, "Xác nhận lúc", formatTimestamp(data.requesterCompletedAt()));

        drawSection(layout, "THÔNG TIN BÀI ĐĂNG (DỮ LIỆU HIỆN TẠI)");
        drawField(layout, "Mã bài đăng", data.listingId().toString());
        drawField(layout, "Tiêu đề", data.listingTitle());
        drawField(layout, "Loại bài đăng", data.listingType());
        drawField(layout, "Danh mục", data.listingCategory() == null || data.listingCategory().isBlank()
                ? UNKNOWN_CATEGORY
                : data.listingCategory());

        drawSection(layout, "GHI CHÚ");
        drawDisclaimer(layout);
    }

    private void drawSection(Layout layout, String title) throws IOException {
        layout.moveDown(SECTION_GAP);
        layout.ensureSpace(LINE_HEIGHT + 8f);
        layout.drawText(layout.bold, SECTION_SIZE, title, MARGIN_X, layout.y);
        layout.moveDown(LINE_HEIGHT - 2f);
        layout.drawRule(MARGIN_X, layout.y, CONTENT_WIDTH, 0.82f, 0.84f, 0.88f);
        layout.moveDown(6f);
    }

    private void drawField(Layout layout, String label, String value) throws IOException {
        List<String> lines = wrapLines(value, layout.regular, BODY_SIZE, FIELD_WIDTH);
        boolean truncated = lines.size() > MAX_VALUE_LINES;
        if (truncated) {
            lines = new ArrayList<>(lines.subList(0, MAX_VALUE_LINES));
            lines.set(MAX_VALUE_LINES - 1,
                    truncateLine(lines.get(MAX_VALUE_LINES - 1), layout.regular, BODY_SIZE, FIELD_WIDTH));
        }

        float required = lines.size() * LINE_HEIGHT + ROW_GAP;
        layout.ensureSpace(required);

        float textY = layout.y;
        for (String line : lines) {
            layout.drawText(layout.regular, BODY_SIZE, line, MARGIN_X + LABEL_WIDTH, textY);
            textY -= LINE_HEIGHT;
        }
        layout.drawText(layout.bold, BODY_SIZE, label + ":", MARGIN_X, layout.y);
        layout.y = textY - ROW_GAP;
    }

    private void drawDisclaimer(Layout layout) throws IOException {
        float innerWidth = CONTENT_WIDTH - 24f;
        List<String> lines = wrapLines(DISCLAIMER, layout.regular, SMALL_SIZE, innerWidth);
        float lineHeight = SMALL_SIZE + 3.5f;
        float boxHeight = lines.size() * lineHeight + 18f;

        layout.ensureSpace(boxHeight + 8f);
        float top = layout.y;

        layout.fillRect(MARGIN_X, top - boxHeight, CONTENT_WIDTH, boxHeight, 0.96f, 0.965f, 0.985f);

        float textY = top - 12f;
        for (String line : lines) {
            layout.drawText(layout.regular, SMALL_SIZE, line, MARGIN_X + 12f, textY);
            textY -= lineHeight;
        }
        layout.y = top - boxHeight - 10f;
    }

    private void stampFooters(PDDocument document, PDFont regular, Instant generatedAt) throws IOException {
        int pageCount = document.getNumberOfPages();
        String generated = "Tài liệu được tạo lúc: " + formatTimestamp(generatedAt);
        for (int i = 0; i < pageCount; i++) {
            PDPage page = document.getPage(i);
            try (PDPageContentStream footer = new PDPageContentStream(
                    document, page, PDPageContentStream.AppendMode.APPEND, true)) {
                footer.setNonStrokingColor(0.45f, 0.45f, 0.45f);

                footer.beginText();
                footer.setFont(regular, FOOTER_SIZE);
                footer.newLineAtOffset(MARGIN_X, 30f);
                footer.showText(generated);
                footer.endText();

                String pageLabel = "Trang " + (i + 1) + "/" + pageCount;
                float labelWidth = regular.getStringWidth(pageLabel) / 1000f * FOOTER_SIZE;
                footer.beginText();
                footer.setFont(regular, FOOTER_SIZE);
                footer.newLineAtOffset(PAGE_SIZE.getWidth() - MARGIN_X - labelWidth, 30f);
                footer.showText(pageLabel);
                footer.endText();
            }
        }
    }

    private List<String> wrapLines(String text, PDFont font, float fontSize, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        String normalized = text == null ? "" : text.replace('\t', ' ').trim();
        if (normalized.isEmpty()) {
            lines.add("");
            return lines;
        }

        for (String paragraph : normalized.split("\\R", -1)) {
            StringBuilder current = new StringBuilder();
            for (String word : paragraph.trim().split("\\s+")) {
                if (word.isEmpty()) {
                    continue;
                }
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (textWidth(font, fontSize, candidate) <= maxWidth) {
                    current = new StringBuilder(candidate);
                } else {
                    if (!current.isEmpty()) {
                        lines.add(current.toString());
                        current = new StringBuilder();
                    }
                    if (textWidth(font, fontSize, word) > maxWidth) {
                        lines.addAll(splitLongWord(word, font, fontSize, maxWidth));
                    } else {
                        current = new StringBuilder(word);
                    }
                }
            }
            lines.add(current.toString());
        }
        return lines;
    }

    private List<String> splitLongWord(String word, PDFont font, float fontSize, float maxWidth) throws IOException {
        List<String> chunks = new ArrayList<>();
        StringBuilder chunk = new StringBuilder();
        for (int i = 0; i < word.length(); i++) {
            String candidate = chunk.toString() + word.charAt(i);
            if (!chunk.isEmpty() && textWidth(font, fontSize, candidate) > maxWidth) {
                chunks.add(chunk.toString());
                chunk = new StringBuilder();
            }
            chunk.append(word.charAt(i));
        }
        if (!chunk.isEmpty()) {
            chunks.add(chunk.toString());
        }
        return chunks;
    }

    private String truncateLine(String line, PDFont font, float fontSize, float maxWidth) throws IOException {
        String ellipsis = line + "...";
        while (!ellipsis.isEmpty() && textWidth(font, fontSize, ellipsis) > maxWidth) {
            ellipsis = ellipsis.substring(0, ellipsis.length() - 4) + "...";
        }
        return ellipsis;
    }

    private float textWidth(PDFont font, float fontSize, String text) throws IOException {
        return font.getStringWidth(text) / 1000f * fontSize;
    }

    private String formatTimestamp(Instant instant) {
        return TIMESTAMP_FORMATTER.format(instant) + " (GMT+7)";
    }

    private String statusLabel(String status) {
        return "COMPLETED".equals(status) ? "Đã hoàn tất" : status;
    }

    /**
     * Holds the current page content stream and vertical cursor while the
     * document is being composed.
     */
    private static final class Layout implements AutoCloseable {
        private final PDDocument document;
        private final PDFont regular;
        private final PDFont bold;
        private PDPageContentStream content;
        private float y;

        Layout(PDDocument document, PDFont regular, PDFont bold) throws IOException {
            this.document = document;
            this.regular = regular;
            this.bold = bold;
            openPage();
        }

        void openPage() throws IOException {
            PDPage page = new PDPage(PAGE_SIZE);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = PAGE_SIZE.getHeight() - MARGIN_TOP;
        }

        void ensureSpace(float required) throws IOException {
            if (y - required < MARGIN_BOTTOM) {
                content.close();
                openPage();
            }
        }

        void moveDown(float amount) {
            y -= amount;
        }

        void drawText(PDFont font, float fontSize, String text, float x, float topY) throws IOException {
            content.beginText();
            content.setFont(font, fontSize);
            content.setNonStrokingColor(0.12f, 0.14f, 0.18f);
            content.newLineAtOffset(x, topY - fontSize);
            content.showText(text);
            content.endText();
        }

        void drawRule(float x, float topY, float width) throws IOException {
            drawRule(x, topY, width, 0.12f, 0.14f, 0.18f);
        }

        void drawRule(float x, float topY, float width, float r, float g, float b) throws IOException {
            content.setStrokingColor(r, g, b);
            content.setLineWidth(0.8f);
            float baseline = topY - 1f;
            content.moveTo(x, baseline);
            content.lineTo(x + width, baseline);
            content.stroke();
        }

        void fillRect(float x, float bottomY, float width, float height, float r, float g, float b) throws IOException {
            content.setNonStrokingColor(r, g, b);
            content.addRect(x, bottomY, width, height);
            content.fill();
        }

        @Override
        public void close() throws IOException {
            content.close();
        }
    }
}
