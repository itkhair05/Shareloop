package com.shareloop.service.reporting.export;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CsvFormulaProtectionTest {

    @Test
    @DisplayName("Prefixes every spreadsheet formula trigger with a single quote")
    void prefixesDangerousPrefixes() {
        assertThat(CsvFormulaProtection.protect("=SUM(A1)")).isEqualTo("'=SUM(A1)");
        assertThat(CsvFormulaProtection.protect("+SUM(A1)")).isEqualTo("'+SUM(A1)");
        assertThat(CsvFormulaProtection.protect("-SUM(A1)")).isEqualTo("'-SUM(A1)");
        assertThat(CsvFormulaProtection.protect("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(CsvFormulaProtection.protect("\tSUM(A1)")).isEqualTo("'\tSUM(A1)");
        assertThat(CsvFormulaProtection.protect("\rSUM(A1)")).isEqualTo("'\rSUM(A1)");
        assertThat(CsvFormulaProtection.protect("\nSUM(A1)")).isEqualTo("'\nSUM(A1)");
    }

    @Test
    @DisplayName("Leaves safe text, numbers and null unchanged")
    void leavesSafeValuesUnchanged() {
        assertThat(CsvFormulaProtection.protect("Người dùng")).isEqualTo("Người dùng");
        assertThat(CsvFormulaProtection.protect("123")).isEqualTo("123");
        assertThat(CsvFormulaProtection.protect("a=b")).isEqualTo("a=b");
        assertThat(CsvFormulaProtection.protect("")).isEmpty();
        assertThat(CsvFormulaProtection.protect(null)).isNull();
    }
}
