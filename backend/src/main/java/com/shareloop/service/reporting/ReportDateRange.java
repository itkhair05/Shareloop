package com.shareloop.service.reporting;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * Normalized reporting period. Local dates are converted into instants using
 * the requested timezone; the range is always [from, to).
 */
public record ReportDateRange(LocalDate from, LocalDate to, ZoneId timezone) {

    public static final String DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
    public static final int DEFAULT_RANGE_DAYS = 30;
    public static final int MAX_RANGE_DAYS = 3660;
    public static final int MAX_BUCKETS = 1000;

    public ReportDateRange {
        if (from == null || to == null || timezone == null) {
            throw new IllegalArgumentException("Reporting period, timezone and date boundaries are required");
        }
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("'from' must be before 'to'");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("Reporting range must not exceed " + MAX_RANGE_DAYS + " days");
        }
    }

    public static ReportDateRange of(LocalDate from, LocalDate to, String timezone) {
        ZoneId zone = resolveTimezone(timezone);
        LocalDate effectiveTo = to != null ? to : LocalDate.now(zone);
        LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(DEFAULT_RANGE_DAYS);
        return new ReportDateRange(effectiveFrom, effectiveTo, zone);
    }

    public static ZoneId resolveTimezone(String timezone) {
        String value = timezone == null || timezone.isBlank() ? DEFAULT_TIMEZONE : timezone.trim();
        try {
            return ZoneId.of(value);
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("Invalid timezone: " + value);
        }
    }

    public Instant fromInclusive() {
        return from.atStartOfDay(timezone).toInstant();
    }

    public Instant toExclusive() {
        return to.atStartOfDay(timezone).toInstant();
    }

    public String timezoneId() {
        return timezone.getId();
    }

    /**
     * Bucket starts aligned to the requested granularity. The first bucket can
     * begin before {@code from} for WEEK and MONTH so labels always align to a
     * Monday or the first day of the month.
     */
    public List<LocalDate> bucketStarts(ReportGranularity granularity) {
        if (granularity == null) {
            throw new IllegalArgumentException("Granularity is required");
        }

        LocalDate current = switch (granularity) {
            case DAY -> from;
            case WEEK -> from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> from.withDayOfMonth(1);
        };

        List<LocalDate> buckets = new ArrayList<>();
        while (current.isBefore(to)) {
            buckets.add(current);
            if (buckets.size() > MAX_BUCKETS) {
                throw new IllegalArgumentException("Reporting period produces more than " + MAX_BUCKETS + " buckets; choose a coarser granularity or a shorter range");
            }
            current = switch (granularity) {
                case DAY -> current.plusDays(1);
                case WEEK -> current.plusWeeks(1);
                case MONTH -> current.plusMonths(1);
            };
        }
        return buckets;
    }
}
