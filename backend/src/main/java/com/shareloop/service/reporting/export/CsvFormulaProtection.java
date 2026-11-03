package com.shareloop.service.reporting.export;

/**
 * Neutralizes spreadsheet formula prefixes in untrusted text values.
 * Numeric values produced by the backend must bypass this helper so that
 * negative numbers remain numeric.
 */
public final class CsvFormulaProtection {

    private CsvFormulaProtection() {
    }

    public static String protect(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }

        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@'
                || first == '\t' || first == '\r' || first == '\n') {
            return "'" + value;
        }
        return value;
    }
}
