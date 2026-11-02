package com.shareloop.service.reporting;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReportDateRangeTest {

    @Test
    @DisplayName("Defaults use Asia/Ho_Chi_Minh and a 30-day window ending today")
    void defaults_useDefaultTimezoneAndThirtyDayWindow() {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate before = LocalDate.now(zone);

        ReportDateRange range = ReportDateRange.of(null, null, null);

        LocalDate after = LocalDate.now(zone);
        assertThat(range.timezone()).isEqualTo(zone);
        assertThat(range.to()).isIn(before, after);
        assertThat(range.from()).isEqualTo(range.to().minusDays(ReportDateRange.DEFAULT_RANGE_DAYS));
    }

    @Test
    @DisplayName("Explicit dates are preserved and blank timezone falls back to the default")
    void explicitDates_arePreserved() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2026, 10, 3),
                LocalDate.of(2026, 11, 2),
                "  "
        );

        assertThat(range.from()).isEqualTo(LocalDate.of(2026, 10, 3));
        assertThat(range.to()).isEqualTo(LocalDate.of(2026, 11, 2));
        assertThat(range.timezoneId()).isEqualTo(ReportDateRange.DEFAULT_TIMEZONE);
    }

    @Test
    @DisplayName("Local boundaries convert to inclusive/exclusive instants in the requested timezone")
    void localBoundaries_convertToInstants() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2026, 10, 3),
                LocalDate.of(2026, 11, 2),
                "Asia/Ho_Chi_Minh"
        );

        assertThat(range.fromInclusive()).isEqualTo(Instant.parse("2026-10-02T17:00:00Z"));
        assertThat(range.toExclusive()).isEqualTo(Instant.parse("2026-11-01T17:00:00Z"));
    }

    @Test
    @DisplayName("UTC boundaries convert without an offset")
    void utcBoundaries_convertWithoutOffset() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2026, 10, 3),
                LocalDate.of(2026, 11, 2),
                "UTC"
        );

        assertThat(range.fromInclusive()).isEqualTo(Instant.parse("2026-10-03T00:00:00Z"));
        assertThat(range.toExclusive()).isEqualTo(Instant.parse("2026-11-02T00:00:00Z"));
    }

    @Test
    @DisplayName("'from' must be strictly before 'to'")
    void invalidRange_throws() {
        assertThatThrownBy(() -> new ReportDateRange(
                LocalDate.of(2026, 11, 2),
                LocalDate.of(2026, 11, 2),
                ZoneId.of("UTC")
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("'from' must be before 'to'");

        assertThatThrownBy(() -> ReportDateRange.of(
                LocalDate.of(2026, 11, 3),
                LocalDate.of(2026, 11, 2),
                "UTC"
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Unsupported timezone identifiers are rejected")
    void invalidTimezone_throws() {
        assertThatThrownBy(() -> ReportDateRange.of(
                LocalDate.of(2026, 10, 3),
                LocalDate.of(2026, 11, 2),
                "Mars/Phobos"
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid timezone");
    }

    @Test
    @DisplayName("Ranges longer than the safety limit are rejected")
    void rangeTooLong_throws() {
        assertThatThrownBy(() -> ReportDateRange.of(
                LocalDate.of(2000, 1, 1),
                LocalDate.of(2015, 1, 1),
                "UTC"
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not exceed");
    }

    @Test
    @DisplayName("Day buckets start on each local date within [from, to)")
    void dayBuckets_startOnEachDate() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2000, 1, 3),
                LocalDate.of(2000, 1, 6),
                "UTC"
        );

        assertThat(range.bucketStarts(ReportGranularity.DAY)).containsExactly(
                LocalDate.of(2000, 1, 3),
                LocalDate.of(2000, 1, 4),
                LocalDate.of(2000, 1, 5)
        );
    }

    @Test
    @DisplayName("Week buckets start on Monday even when the range starts mid-week")
    void weekBuckets_startOnMonday() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2000, 1, 5),
                LocalDate.of(2000, 1, 20),
                "UTC"
        );

        assertThat(range.bucketStarts(ReportGranularity.WEEK)).containsExactly(
                LocalDate.of(2000, 1, 3),
                LocalDate.of(2000, 1, 10),
                LocalDate.of(2000, 1, 17)
        );
    }

    @Test
    @DisplayName("Month buckets start on the first day of each month")
    void monthBuckets_startOnFirstDayOfMonth() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2000, 1, 15),
                LocalDate.of(2000, 3, 2),
                "UTC"
        );

        assertThat(range.bucketStarts(ReportGranularity.MONTH)).containsExactly(
                LocalDate.of(2000, 1, 1),
                LocalDate.of(2000, 2, 1),
                LocalDate.of(2000, 3, 1)
        );
    }

    @Test
    @DisplayName("Too many buckets are rejected instead of returning an unbounded series")
    void tooManyBuckets_throws() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2000, 1, 1),
                LocalDate.of(2003, 1, 1),
                "UTC"
        );

        assertThatThrownBy(() -> range.bucketStarts(ReportGranularity.DAY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than");
    }

    @Test
    @DisplayName("Granularity is required")
    void nullGranularity_throws() {
        ReportDateRange range = ReportDateRange.of(
                LocalDate.of(2000, 1, 1),
                LocalDate.of(2000, 1, 2),
                "UTC"
        );

        assertThatThrownBy(() -> range.bucketStarts(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Granularity maps to the PostgreSQL date_trunc unit")
    void granularity_mapsToDateTruncUnit() {
        assertThat(ReportGranularity.DAY.toDateTruncUnit()).isEqualTo("day");
        assertThat(ReportGranularity.WEEK.toDateTruncUnit()).isEqualTo("week");
        assertThat(ReportGranularity.MONTH.toDateTruncUnit()).isEqualTo("month");
        assertThat(List.of(ReportGranularity.values())).containsExactly(
                ReportGranularity.DAY,
                ReportGranularity.WEEK,
                ReportGranularity.MONTH
        );
    }
}
