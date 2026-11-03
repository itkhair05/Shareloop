package com.shareloop.service.reporting.export;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CsvWriterTest {

    private final CsvWriter writer = new CsvWriter();

    @Test
    @DisplayName("Writes a UTF-8 BOM, the header and CRLF line endings")
    void writesBomHeaderAndCrlf() {
        byte[] bytes = writer.write(List.of("a", "b"), List.of(List.of("1", "2")));

        assertThat(bytes[0]).isEqualTo((byte) 0xEF);
        assertThat(bytes[1]).isEqualTo((byte) 0xBB);
        assertThat(bytes[2]).isEqualTo((byte) 0xBF);

        String content = new String(bytes, StandardCharsets.UTF_8);
        assertThat(content).isEqualTo("\uFEFFa,b\r\n1,2\r\n");
    }

    @Test
    @DisplayName("Quotes commas, quotes and line breaks using RFC 4180 escaping")
    void escapesSpecialCharacters() {
        byte[] bytes = writer.write(
                List.of("value"),
                List.of(
                        List.of("Ha Noi, Viet Nam"),
                        List.of("Say \"hello\""),
                        List.of("line one\nline two"),
                        List.of("carriage\rreturn")
                )
        );

        String content = new String(bytes, StandardCharsets.UTF_8);
        assertThat(content).contains("\"Ha Noi, Viet Nam\"");
        assertThat(content).contains("\"Say \"\"hello\"\"\"");
        assertThat(content).contains("\"line one\nline two\"");
        assertThat(content).contains("\"carriage\rreturn\"");
    }

    @Test
    @DisplayName("Serializes null as an empty value and preserves empty strings")
    void handlesNullAndEmptyValues() {
        String content = new String(
                writer.write(List.of("a", "b", "c"), List.of(Arrays.asList(null, "", "x"))),
                StandardCharsets.UTF_8
        );

        assertThat(content).isEqualTo("\uFEFFa,b,c\r\n,,x\r\n");
    }

    @Test
    @DisplayName("Preserves zero and negative numeric values without sanitizing them")
    void preservesNumericValues() {
        String content = new String(
                writer.write(List.of("value"), List.of(List.of("0"), List.of("-12"))),
                StandardCharsets.UTF_8
        );

        assertThat(content).isEqualTo("\uFEFFvalue\r\n0\r\n-12\r\n");
    }

    @Test
    @DisplayName("Writes Vietnamese text unchanged in UTF-8")
    void writesVietnameseText() {
        String content = new String(
                writer.write(List.of("metric_label_vi"), List.of(List.of("Người dùng đăng ký mới"))),
                StandardCharsets.UTF_8
        );

        assertThat(content).contains("Người dùng đăng ký mới");
    }

    @Test
    @DisplayName("Writes a header-only file when there are no rows")
    void writesHeaderOnlyForEmptyRows() {
        String content = new String(writer.write(List.of("a", "b"), List.of()), StandardCharsets.UTF_8);

        assertThat(content).isEqualTo("\uFEFFa,b\r\n");
    }

    @Test
    @DisplayName("Rejects rows whose column count does not match the header")
    void rejectsMismatchedColumns() {
        assertThatThrownBy(() -> writer.write(List.of("a", "b"), List.of(List.of("only-one"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("expected 2");
    }

    @Test
    @DisplayName("Rejects a missing header definition")
    void rejectsMissingHeaders() {
        assertThatThrownBy(() -> writer.write(null, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
