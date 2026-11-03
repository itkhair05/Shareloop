package com.shareloop.service.reporting.export;

import java.util.List;

/**
 * A single-header CSV table. Rows may contain null cells, which are
 * serialized as empty values.
 */
public record CsvTable(List<String> headers, List<List<String>> rows) {
}
