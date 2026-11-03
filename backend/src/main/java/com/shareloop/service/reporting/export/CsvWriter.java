package com.shareloop.service.reporting.export;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Minimal RFC 4180 CSV writer using only Java standard APIs. Output is UTF-8
 * with a BOM and CRLF line endings so Microsoft Excel renders Vietnamese text
 * correctly.
 */
@Component
public class CsvWriter {

    private static final char BOM = '\uFEFF';
    private static final String LINE_ENDING = "\r\n";

    public byte[] write(CsvTable table) {
        return write(table.headers(), table.rows());
    }

    public byte[] write(List<String> headers, List<List<String>> rows) {
        if (headers == null) {
            throw new IllegalArgumentException("CSV headers are required");
        }

        StringBuilder content = new StringBuilder();
        content.append(BOM);
        appendRow(content, headers, headers.size());

        if (rows != null) {
            for (List<String> row : rows) {
                appendRow(content, row, headers.size());
            }
        }

        return content.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void appendRow(StringBuilder content, List<String> row, int expectedColumns) {
        if (row == null || row.size() != expectedColumns) {
            throw new IllegalStateException(
                    "CSV row has " + (row == null ? 0 : row.size())
                            + " columns; expected " + expectedColumns
            );
        }

        for (int index = 0; index < row.size(); index++) {
            if (index > 0) {
                content.append(',');
            }
            content.append(escape(row.get(index)));
        }
        content.append(LINE_ENDING);
    }

    private String escape(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        boolean needsQuoting = value.indexOf(',') >= 0
                || value.indexOf('"') >= 0
                || value.indexOf('\r') >= 0
                || value.indexOf('\n') >= 0;

        if (!needsQuoting) {
            return value;
        }

        StringBuilder escaped = new StringBuilder(value.length() + 2);
        escaped.append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character == '"') {
                escaped.append('"');
            }
            escaped.append(character);
        }
        escaped.append('"');
        return escaped.toString();
    }
}
