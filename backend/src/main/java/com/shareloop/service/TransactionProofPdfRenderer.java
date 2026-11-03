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
import java.util.Locale;

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

    private static final float BRAND_SIZE = 15f;
    private static final float DESCRIPTOR_SIZE = 8.5f;
    private static final float TITLE_SIZE = 19f;
    private static final float PILL_SIZE = 8.5f;
    private static final float SECTION_SIZE = 11f;
    private static final float BODY_SIZE = 10f;
    private static final float SMALL_SIZE = 8.5f;
    private static final float FOOTER_SIZE = 7.5f;

    private static final float LINE_HEIGHT = 13.5f;
    private static final float SECTION_GAP = 16f;
    private static final float ROW_GAP = 4f;
    private static final float LABEL_WIDTH = 132f;
    private static final float FIELD_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;
    private static final int MAX_VALUE_LINES = 4;
    private static final int MAX_NAME_LINES = 2;

    private static final float PANEL_PAD = 10f;
    private static final float PANEL_GAP = 8f;
    private static final float PILL_HEIGHT = 15f;
    private static final float PILL_PAD_X = 9f;

    private static final float[] EMERALD = {0.043f, 0.431f, 0.310f};
    private static final float[] SLATE = {0.11f, 0.15f, 0.20f};
    private static final float[] BODY_COLOR = {0.15f, 0.17f, 0.21f};
    private static final float[] MUTED = {0.42f, 0.46f, 0.52f};
    private static final float[] RULE_COLOR = {0.85f, 0.87f, 0.90f};
    private static final float[] PANEL_BG = {0.965f, 0.972f, 0.978f};
    private static final float[] PILL_BG = {0.90f, 0.96f, 0.93f};
    private static final float[] PILL_TEXT = {0.05f, 0.45f, 0.30f};

    private static final ZoneId TIME_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(TIME_ZONE);

    private static final String UNKNOWN_CATEGORY = "Không xác định";
    private static final String BRAND = "ShareLoop";
    private static final String DESCRIPTOR = "Nền tảng chia sẻ đồ dùng cộng đồng";
    private static final String DOCUMENT_TITLE = "BIÊN NHẬN GIAO DỊCH";
    private static final String CONFIRMED_PREFIX = "Đã xác nhận lúc ";
    private static final String NOT_CONFIRMED = "Chưa xác nhận";
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
        drawHeader(layout, data);

        drawSection(layout, "01", "THÔNG TIN GIAO DỊCH");
        drawField(layout, "Mã giao dịch", data.transactionId().toString());
        drawField(layout, "Ngày tạo giao dịch", formatTimestamp(data.transactionCreatedAt()));
        drawField(layout, "Trạng thái giao dịch", TransactionProofLabels.transactionStatusLabel(data.transactionStatus()));
        drawField(layout, "Thời điểm hoàn tất", formatTimestamp(data.completionAt()));

        drawSection(layout, "02", "XÁC NHẬN CỦA HAI BÊN");
        drawParticipantPanel(layout, "CHỦ BÀI ĐĂNG", data.ownerDisplayName(), data.ownerCompletedAt());
        layout.moveDown(PANEL_GAP);
        drawParticipantPanel(layout, "NGƯỜI NHẬN", data.requesterDisplayName(), data.requesterCompletedAt());

        drawSection(layout, "03", "THÔNG TIN BÀI ĐĂNG (DỮ LIỆU HIỆN TẠI)");
        drawField(layout, "Mã bài đăng", data.listingId().toString());
        drawField(layout, "Tiêu đề", data.listingTitle());
        drawField(layout, "Hình thức", TransactionProofLabels.listingTypeLabel(data.listingType()));
        drawField(layout, "Danh mục", data.listingCategory() == null || data.listingCategory().isBlank()
                ? UNKNOWN_CATEGORY
                : data.listingCategory());

        drawSection(layout, "04", "GHI CHÚ");
        drawDisclaimer(layout);
    }

    private void drawHeader(Layout layout, TransactionProofData data) throws IOException {
        layout.drawText(layout.bold, BRAND_SIZE, BRAND, MARGIN_X, layout.y, EMERALD);
        float descriptorWidth = textWidth(layout.regular, DESCRIPTOR_SIZE, DESCRIPTOR);
        layout.drawText(layout.regular, DESCRIPTOR_SIZE, DESCRIPTOR,
                MARGIN_X + CONTENT_WIDTH - descriptorWidth, layout.y, MUTED);
        layout.moveDown(24f);

        layout.drawText(layout.bold, TITLE_SIZE, DOCUMENT_TITLE, MARGIN_X, layout.y, SLATE);
        layout.moveDown(28f);

        String badge = TransactionProofLabels.transactionStatusLabel(data.transactionStatus())
                .toUpperCase(Locale.ROOT);
        float badgeWidth = textWidth(layout.bold, PILL_SIZE, badge) + 2 * PILL_PAD_X;
        float pillBottom = layout.y - PILL_HEIGHT + 3f;
        layout.fillRect(MARGIN_X, pillBottom, badgeWidth, PILL_HEIGHT, PILL_BG[0], PILL_BG[1], PILL_BG[2]);
        layout.drawText(layout.bold, PILL_SIZE, badge, MARGIN_X + PILL_PAD_X, layout.y - 2f, PILL_TEXT);

        String idLine = "Mã giao dịch: " + data.transactionId();
        layout.drawText(layout.regular, SMALL_SIZE, idLine,
                MARGIN_X + badgeWidth + 12f, layout.y - 2f, MUTED);
        layout.moveDown(PILL_HEIGHT + 12f);
        layout.drawRule(MARGIN_X, layout.y, CONTENT_WIDTH, RULE_COLOR);
    }

    private void drawSection(Layout layout, String number, String title) throws IOException {
        layout.moveDown(SECTION_GAP);
        layout.ensureSpace(LINE_HEIGHT + 8f);
        layout.drawText(layout.bold, SECTION_SIZE, number, MARGIN_X, layout.y, EMERALD);
        float numberWidth = textWidth(layout.bold, SECTION_SIZE, number);
        layout.drawText(layout.bold, SECTION_SIZE, title, MARGIN_X + numberWidth + 8f, layout.y, SLATE);
        layout.moveDown(LINE_HEIGHT - 2f);
        layout.drawRule(MARGIN_X, layout.y, CONTENT_WIDTH, RULE_COLOR);
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
            layout.drawText(layout.regular, BODY_SIZE, line, MARGIN_X + LABEL_WIDTH, textY, BODY_COLOR);
            textY -= LINE_HEIGHT;
        }
        layout.drawText(layout.bold, BODY_SIZE, label + ":", MARGIN_X, layout.y, SLATE);
        layout.y = textY - ROW_GAP;
    }

    private void drawParticipantPanel(Layout layout, String role, String name, Instant confirmedAt) throws IOException {
        float innerWidth = CONTENT_WIDTH - 2 * PANEL_PAD - 6f;
        List<String> nameLines = wrapLines(name, layout.bold, BODY_SIZE, innerWidth);
        boolean truncated = nameLines.size() > MAX_NAME_LINES;
        if (truncated) {
            nameLines = new ArrayList<>(nameLines.subList(0, MAX_NAME_LINES));
            nameLines.set(MAX_NAME_LINES - 1,
                    truncateLine(nameLines.get(MAX_NAME_LINES - 1), layout.bold, BODY_SIZE, innerWidth));
        }

        String confirmLine = confirmedAt != null ? CONFIRMED_PREFIX + formatTimestamp(confirmedAt) : NOT_CONFIRMED;

        float height = PANEL_PAD + 9f + 4f + nameLines.size() * LINE_HEIGHT + 4f + 9f + PANEL_PAD;
        layout.ensureSpace(height + 4f);
        float top = layout.y;

        layout.fillRect(MARGIN_X, top - height, CONTENT_WIDTH, height, PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);
        layout.fillRect(MARGIN_X, top - height, 2.5f, height, EMERALD[0], EMERALD[1], EMERALD[2]);

        float textY = top - PANEL_PAD;
        layout.drawText(layout.bold, 8f, role, MARGIN_X + PANEL_PAD + 4f, textY, MUTED);
        textY -= 13f;
        for (String line : nameLines) {
            layout.drawText(layout.bold, BODY_SIZE, line, MARGIN_X + PANEL_PAD + 4f, textY, SLATE);
            textY -= LINE_HEIGHT;
        }
        textY -= 4f;
        layout.drawText(layout.regular, SMALL_SIZE, confirmLine, MARGIN_X + PANEL_PAD + 4f, textY, MUTED);

        layout.y = top - height;
    }

    private void drawDisclaimer(Layout layout) throws IOException {
        float innerWidth = CONTENT_WIDTH - 24f;
        List<String> lines = wrapLines(DISCLAIMER, layout.regular, SMALL_SIZE, innerWidth);
        float lineHeight = SMALL_SIZE + 3.5f;
        float boxHeight = lines.size() * lineHeight + 18f;

        layout.ensureSpace(boxHeight + 8f);
        float top = layout.y;

        layout.fillRect(MARGIN_X, top - boxHeight, CONTENT_WIDTH, boxHeight, PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);

        float textY = top - 12f;
        for (String line : lines) {
            layout.drawText(layout.regular, SMALL_SIZE, line, MARGIN_X + 12f, textY, MUTED);
            textY -= lineHeight;
        }
        layout.y = top - boxHeight - 10f;
    }

    static void stampFooters(PDDocument document, PDFont regular, Instant generatedAt) throws IOException {
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

    private static String formatTimestamp(Instant instant) {
        return TIMESTAMP_FORMATTER.format(instant) + " (GMT+7)";
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

        void drawText(PDFont font, float fontSize, String text, float x, float topY, float[] rgb) throws IOException {
            content.beginText();
            content.setFont(font, fontSize);
            content.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
            content.newLineAtOffset(x, topY - fontSize);
            content.showText(text);
            content.endText();
        }

        void drawRule(float x, float topY, float width, float[] rgb) throws IOException {
            content.setStrokingColor(rgb[0], rgb[1], rgb[2]);
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
