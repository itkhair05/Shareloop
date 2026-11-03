package com.shareloop.service.reporting.export;

import com.shareloop.dto.reporting.CategoryDistributionItem;
import com.shareloop.dto.reporting.ListingsReportMetrics;
import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ModerationReportMetrics;
import com.shareloop.dto.reporting.ModerationSummaryResponse;
import com.shareloop.dto.reporting.ReportDistributionItem;
import com.shareloop.dto.reporting.ReportPeriodResponse;
import com.shareloop.dto.reporting.ReportTimeseriesPoint;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.ReviewsReportMetrics;
import com.shareloop.dto.reporting.ReviewsSummaryResponse;
import com.shareloop.dto.reporting.SupportOpenWorkloadResponse;
import com.shareloop.dto.reporting.SupportReportMetrics;
import com.shareloop.dto.reporting.SupportSummaryResponse;
import com.shareloop.dto.reporting.TopRequestedListingItem;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.TransactionsReportMetrics;
import com.shareloop.dto.reporting.TransactionsSummaryResponse;
import com.shareloop.dto.reporting.UsersReportMetrics;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.service.reporting.ReportDateRange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AdminReportCsvMapperTest {

    private static final String GENERATED_AT = "2026-01-02T10:15:30+07:00";
    private static final String FILTERS = "{\"role\":\"USER\"}";
    private static final ReportPeriodResponse PERIOD = ReportPeriodResponse.from(
            new ReportDateRange(
                    LocalDate.of(2026, 1, 1),
                    LocalDate.of(2026, 1, 8),
                    ZoneId.of("Asia/Ho_Chi_Minh")
            )
    );

    private final AdminReportCsvMapper mapper = new AdminReportCsvMapper();

    @Test
    @DisplayName("Users summary keeps existing metric keys and repeats metadata on every row")
    void usersSummary_mapsMetricKeysAndMetadata() {
        UsersSummaryResponse response = new UsersSummaryResponse(
                PERIOD,
                new UsersReportMetrics(
                        5,
                        List.of(
                                new ReportDistributionItem("USER", 4),
                                new ReportDistributionItem("ADMIN", 1)
                        ),
                        List.of(
                                new ReportDistributionItem("ACTIVE", 3),
                                new ReportDistributionItem("SUSPENDED", 2),
                                new ReportDistributionItem("DEACTIVATED", 0)
                        )
                ),
                "semantics"
        );

        CsvTable table = mapper.usersSummary(response, FILTERS, GENERATED_AT);

        assertThat(table.headers()).containsExactly(
                "section", "metric_key", "metric_label_vi", "dimension_key",
                "dimension_label_vi", "value", "period_from", "period_to",
                "timezone", "filters", "generated_at"
        );
        assertThat(table.rows()).hasSize(6);
        assertThat(metricKeys(table)).containsExactly(
                "USER_REGISTRATIONS",
                "USER_ROLE_DISTRIBUTION",
                "USER_ROLE_DISTRIBUTION",
                "USER_STATUS_DISTRIBUTION",
                "USER_STATUS_DISTRIBUTION",
                "USER_STATUS_DISTRIBUTION"
        );

        List<String> totalRow = table.rows().get(0);
        assertThat(totalRow.get(2)).isEqualTo("Người dùng đăng ký mới");
        assertThat(totalRow.get(3)).isEqualTo("TOTAL");
        assertThat(totalRow.get(4)).isEqualTo("Tổng");
        assertThat(totalRow.get(5)).isEqualTo("5");

        List<String> roleRow = table.rows().get(1);
        assertThat(roleRow.get(3)).isEqualTo("USER");
        assertThat(roleRow.get(4)).isEqualTo("Người dùng");
        assertThat(roleRow.get(5)).isEqualTo("4");

        List<String> zeroRow = table.rows().get(5);
        assertThat(zeroRow.get(3)).isEqualTo("DEACTIVATED");
        assertThat(zeroRow.get(5)).isEqualTo("0");

        for (List<String> row : table.rows()) {
            assertThat(row).hasSize(11);
            assertThat(row.get(0)).isEqualTo("users");
            assertThat(row.get(6)).isEqualTo("2026-01-01");
            assertThat(row.get(7)).isEqualTo("2026-01-08");
            assertThat(row.get(8)).isEqualTo("Asia/Ho_Chi_Minh");
            assertThat(row.get(9)).isEqualTo(FILTERS);
            assertThat(row.get(10)).isEqualTo(GENERATED_AT);
        }
    }

    @Test
    @DisplayName("Listing category names are formula-protected without changing their metric values")
    void listingsSummary_protectsCategoryNames() {
        ListingsSummaryResponse response = new ListingsSummaryResponse(
                PERIOD,
                new ListingsReportMetrics(
                        3,
                        List.of(new ReportDistributionItem("ACTIVE", 3)),
                        List.of(
                                new ReportDistributionItem("GIVEAWAY", 2),
                                new ReportDistributionItem("SALE", 1)
                        ),
                        List.of(new CategoryDistributionItem(
                                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                                "=EVIL()",
                                3
                        ))
                ),
                "semantics"
        );

        CsvTable table = mapper.listingsSummary(response, "{}", GENERATED_AT);

        assertThat(metricKeys(table)).containsExactly(
                "LISTING_CREATIONS",
                "LISTING_STATUS_DISTRIBUTION",
                "LISTING_TYPE_DISTRIBUTION",
                "LISTING_TYPE_DISTRIBUTION",
                "LISTING_CATEGORY_DISTRIBUTION"
        );
        List<String> categoryRow = table.rows().get(4);
        assertThat(categoryRow.get(3)).isEqualTo("11111111-1111-1111-1111-111111111111");
        assertThat(categoryRow.get(4)).isEqualTo("'=EVIL()");
        assertThat(categoryRow.get(5)).isEqualTo("3");
    }

    @Test
    @DisplayName("Transactions and moderation summaries keep their existing metric identifiers")
    void transactionsAndModeration_keepMetricIdentifiers() {
        TransactionsSummaryResponse transactions = new TransactionsSummaryResponse(
                PERIOD,
                new TransactionsReportMetrics(4, List.of(
                        new ReportDistributionItem("PENDING", 1),
                        new ReportDistributionItem("COMPLETED", 3)
                )),
                "semantics"
        );
        CsvTable transactionsTable = mapper.transactionsSummary(transactions, "{}", GENERATED_AT);

        assertThat(metricKeys(transactionsTable)).containsExactly(
                "TRANSACTION_CREATIONS",
                "TRANSACTION_STATUS_DISTRIBUTION",
                "TRANSACTION_STATUS_DISTRIBUTION"
        );
        assertThat(transactionsTable.rows().get(2).get(4)).isEqualTo("Đã hoàn tất");

        ModerationSummaryResponse moderation = new ModerationSummaryResponse(
                PERIOD,
                new ModerationReportMetrics(
                        2,
                        List.of(new ReportDistributionItem("INVESTIGATING", 2)),
                        List.of(new ReportDistributionItem("FRAUD_OR_SCAM", 2)),
                        List.of(new ReportDistributionItem("LISTING", 2))
                ),
                "semantics"
        );
        CsvTable moderationTable = mapper.moderationSummary(moderation, "{}", GENERATED_AT);

        assertThat(metricKeys(moderationTable)).containsExactly(
                "MODERATION_REPORT_CREATIONS",
                "MODERATION_STATUS_DISTRIBUTION",
                "MODERATION_CATEGORY_DISTRIBUTION",
                "MODERATION_TARGET_TYPE_DISTRIBUTION"
        );
        assertThat(moderationTable.rows().get(2).get(4)).isEqualTo("Lừa đảo");
        assertThat(moderationTable.rows().get(3).get(4)).isEqualTo("Tin đăng");
    }

    @Test
    @DisplayName("Review averages become empty cells when there are no reviews")
    void reviewsSummary_nullAveragesStayEmpty() {
        ReviewsSummaryResponse response = new ReviewsSummaryResponse(
                PERIOD,
                new ReviewsReportMetrics(
                        0, 0, 0, null, null,
                        List.of(
                                new ReportDistributionItem("1", 0),
                                new ReportDistributionItem("2", 0),
                                new ReportDistributionItem("3", 0),
                                new ReportDistributionItem("4", 0),
                                new ReportDistributionItem("5", 0)
                        ),
                        List.of(
                                new ReportDistributionItem("1", 0),
                                new ReportDistributionItem("2", 0),
                                new ReportDistributionItem("3", 0),
                                new ReportDistributionItem("4", 0),
                                new ReportDistributionItem("5", 0)
                        )
                ),
                "semantics"
        );

        CsvTable table = mapper.reviewsSummary(response, "{}", GENERATED_AT);

        assertThat(table.rows()).hasSize(15);
        assertThat(metricKeys(table)).contains(
                "REVIEW_CREATIONS",
                "REVIEWS_VISIBLE",
                "REVIEWS_HIDDEN",
                "REVIEWS_AVERAGE_RATING_VISIBLE",
                "REVIEWS_AVERAGE_RATING_ALL",
                "REVIEW_RATING_DISTRIBUTION_ALL",
                "REVIEW_RATING_DISTRIBUTION_VISIBLE"
        );

        List<String> averageVisible = rowByMetric(table, "REVIEWS_AVERAGE_RATING_VISIBLE");
        List<String> averageAll = rowByMetric(table, "REVIEWS_AVERAGE_RATING_ALL");
        assertThat(averageVisible.get(5)).isNull();
        assertThat(averageAll.get(5)).isNull();
    }

    @Test
    @DisplayName("Support summary includes the system-wide workload rows and scope disclaimer")
    void supportSummary_includesWorkloadScope() {
        SupportSummaryResponse response = new SupportSummaryResponse(
                PERIOD,
                new SupportReportMetrics(
                        7,
                        List.of(
                                new ReportDistributionItem("PENDING", 2),
                                new ReportDistributionItem("IN_PROGRESS", 3),
                                new ReportDistributionItem("RESOLVED", 2),
                                new ReportDistributionItem("CLOSED", 0)
                        ),
                        List.of(
                                new ReportDistributionItem("TRANSACTION_ISSUE", 4),
                                new ReportDistributionItem("SAFETY_CONCERN", 3)
                        )
                ),
                "semantics",
                new SupportOpenWorkloadResponse(
                        Instant.parse("2026-01-02T03:00:00Z"),
                        "CURRENT_SYSTEM_WIDE_ALL_DATES",
                        2,
                        3,
                        5
                )
        );

        CsvTable table = mapper.supportSummary(response, "{}", GENERATED_AT);

        assertThat(metricKeys(table)).contains(
                "SUPPORT_REQUEST_CREATIONS",
                "SUPPORT_STATUS_DISTRIBUTION",
                "SUPPORT_CATEGORY_DISTRIBUTION",
                "SUPPORT_CURRENT_OPEN_WORKLOAD",
                "SUPPORT_CURRENT_OPEN_WORKLOAD_SCOPE",
                "SUPPORT_CURRENT_OPEN_WORKLOAD_AS_OF"
        );

        List<List<String>> workloadRows = rowsByMetric(table, "SUPPORT_CURRENT_OPEN_WORKLOAD");
        assertThat(workloadRows).hasSize(3);
        assertThat(workloadRows.get(0).get(3)).isEqualTo("PENDING");
        assertThat(workloadRows.get(1).get(3)).isEqualTo("IN_PROGRESS");
        assertThat(workloadRows.get(2).get(3)).isEqualTo("TOTAL_OPEN");
        assertThat(workloadRows.get(2).get(5)).isEqualTo("5");

        List<String> scopeRow = rowByMetric(table, "SUPPORT_CURRENT_OPEN_WORKLOAD_SCOPE");
        assertThat(scopeRow.get(5)).isEqualTo("CURRENT_SYSTEM_WIDE_ALL_DATES");

        List<String> asOfRow = rowByMetric(table, "SUPPORT_CURRENT_OPEN_WORKLOAD_AS_OF");
        assertThat(asOfRow.get(5)).isEqualTo("2026-01-02T03:00:00Z");
    }

    @Test
    @DisplayName("Overview uses the documented metric identifiers and excludes current support workload")
    void overview_usesExistingMetricIdentifiers() {
        ReportingOverviewResponse response = new ReportingOverviewResponse(
                PERIOD,
                List.of("USERS", "LISTINGS", "TRANSACTIONS", "MODERATION", "REVIEWS", "SUPPORT"),
                List.of("USERS_CREATED"),
                new UsersReportMetrics(1, List.of(new ReportDistributionItem("USER", 1)),
                        List.of(new ReportDistributionItem("ACTIVE", 1))),
                new ListingsReportMetrics(1, List.of(new ReportDistributionItem("ACTIVE", 1)),
                        List.of(new ReportDistributionItem("SALE", 1)),
                        List.of(new CategoryDistributionItem(
                                UUID.fromString("22222222-2222-2222-2222-222222222222"), "Điện tử", 1))),
                new TransactionsReportMetrics(0, List.of(new ReportDistributionItem("PENDING", 0))),
                new ModerationReportMetrics(0,
                        List.of(new ReportDistributionItem("PENDING", 0)),
                        List.of(new ReportDistributionItem("OTHER", 0)),
                        List.of(new ReportDistributionItem("USER", 0))),
                new ReviewsReportMetrics(0, 0, 0, null, null,
                        List.of(new ReportDistributionItem("1", 0), new ReportDistributionItem("2", 0),
                                new ReportDistributionItem("3", 0), new ReportDistributionItem("4", 0),
                                new ReportDistributionItem("5", 0)),
                        List.of(new ReportDistributionItem("1", 0), new ReportDistributionItem("2", 0),
                                new ReportDistributionItem("3", 0), new ReportDistributionItem("4", 0),
                                new ReportDistributionItem("5", 0))),
                new SupportReportMetrics(0,
                        List.of(new ReportDistributionItem("PENDING", 0)),
                        List.of(new ReportDistributionItem("OTHER", 0))),
                "disclaimer"
        );

        CsvTable table = mapper.overviewSummary(response, "{}", GENERATED_AT);

        assertThat(metricKeys(table)).containsExactly(
                "USERS_CREATED",
                "USERS_BY_ROLE",
                "USERS_BY_CURRENT_STATUS",
                "LISTINGS_CREATED",
                "LISTINGS_BY_CURRENT_STATUS",
                "LISTINGS_BY_TYPE",
                "LISTINGS_BY_CATEGORY",
                "TRANSACTIONS_CREATED",
                "TRANSACTIONS_BY_CURRENT_STATUS",
                "MODERATION_REPORTS_CREATED",
                "MODERATION_BY_CURRENT_STATUS",
                "MODERATION_BY_CATEGORY",
                "MODERATION_BY_TARGET_TYPE",
                "REVIEWS_CREATED",
                "REVIEWS_BY_VISIBILITY",
                "REVIEWS_BY_VISIBILITY",
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_AVERAGE_RATING_VISIBLE",
                "REVIEWS_AVERAGE_RATING_ALL",
                "SUPPORT_REQUESTS_CREATED",
                "SUPPORT_BY_CURRENT_STATUS",
                "SUPPORT_BY_CATEGORY"
        );
        assertThat(metricKeys(table)).doesNotContain("SUPPORT_CURRENT_OPEN_WORKLOAD");
        assertThat(table.rows()).allSatisfy(row -> assertThat(row.get(0)).isEqualTo("overview"));
    }

    @Test
    @DisplayName("Time series rows carry bucket start, granularity and the metric label")
    void timeseries_mapsBucketsAndGranularity() {
        ReportTimeseriesResponse response = new ReportTimeseriesResponse(
                "USER_REGISTRATIONS",
                PERIOD,
                "WEEK",
                List.of(
                        new ReportTimeseriesPoint(LocalDate.of(2025, 12, 29), 0),
                        new ReportTimeseriesPoint(LocalDate.of(2026, 1, 5), 3)
                )
        );

        CsvTable table = mapper.timeseries(AdminReportExportSection.USERS, response, "{}", GENERATED_AT);

        assertThat(table.headers()).containsExactly(
                "section", "metric_key", "metric_label_vi", "bucket_start", "value",
                "period_from", "period_to", "timezone", "granularity", "filters", "generated_at"
        );
        assertThat(table.rows()).hasSize(2);
        assertThat(table.rows().get(0)).containsExactly(
                "users", "USER_REGISTRATIONS", "Người dùng đăng ký mới", "2025-12-29", "0",
                "2026-01-01", "2026-01-08", "Asia/Ho_Chi_Minh", "WEEK", "{}", GENERATED_AT
        );
        assertThat(table.rows().get(1).get(3)).isEqualTo("2026-01-05");
        assertThat(table.rows().get(1).get(4)).isEqualTo("3");
    }

    @Test
    @DisplayName("Top requested rows are ranked and protect user-controlled text")
    void topRequested_ranksAndProtectsText() {
        TopRequestedListingsResponse response = new TopRequestedListingsResponse(
                PERIOD,
                10,
                List.of("PENDING", "ACCEPTED", "REJECTED"),
                List.of(new TopRequestedListingItem(
                        UUID.fromString("33333333-3333-3333-3333-333333333333"),
                        "=HYPERLINK(\"http://evil\")",
                        UUID.fromString("44444444-4444-4444-4444-444444444444"),
                        "@SUM(1,1)",
                        UUID.fromString("55555555-5555-5555-5555-555555555555"),
                        "-danger",
                        ListingType.SALE,
                        9
                ))
        );

        CsvTable table = mapper.topRequested(response, "{\"limit\":10}", GENERATED_AT);

        assertThat(table.headers()).containsExactly(
                "rank", "listing_id", "listing_title", "owner_id", "owner_display_name",
                "category_id", "category_name", "listing_type", "request_count",
                "period_from", "period_to", "timezone", "filters", "generated_at"
        );
        assertThat(table.rows()).hasSize(1);
        List<String> row = table.rows().get(0);
        assertThat(row.get(0)).isEqualTo("1");
        assertThat(row.get(1)).isEqualTo("33333333-3333-3333-3333-333333333333");
        assertThat(row.get(2)).isEqualTo("'=HYPERLINK(\"http://evil\")");
        assertThat(row.get(4)).isEqualTo("'@SUM(1,1)");
        assertThat(row.get(6)).isEqualTo("'-danger");
        assertThat(row.get(7)).isEqualTo("SALE");
        assertThat(row.get(8)).isEqualTo("9");
    }

    @Test
    @DisplayName("Empty top requested export emits a single explanatory row without fabricating records")
    void topRequested_emptyResponseEmitsNoteRow() {
        TopRequestedListingsResponse response = new TopRequestedListingsResponse(
                PERIOD, 10, List.of("PENDING", "ACCEPTED", "REJECTED"), List.of());

        CsvTable table = mapper.topRequested(response, "{}", GENERATED_AT);

        assertThat(table.rows()).hasSize(1);
        List<String> row = table.rows().get(0);
        assertThat(row.get(0)).isEmpty();
        assertThat(row.get(1)).isEmpty();
        assertThat(row.get(2)).isEqualTo("Không có dữ liệu trong kỳ");
        assertThat(row.get(8)).isEmpty();
        assertThat(row.get(9)).isEqualTo("2026-01-01");
        assertThat(row.get(10)).isEqualTo("2026-01-08");
    }

    private static List<String> metricKeys(CsvTable table) {
        List<String> keys = new ArrayList<>();
        for (List<String> row : table.rows()) {
            keys.add(row.get(1));
        }
        return keys;
    }

    private static List<String> rowByMetric(CsvTable table, String metricKey) {
        return rowsByMetric(table, metricKey).get(0);
    }

    private static List<List<String>> rowsByMetric(CsvTable table, String metricKey) {
        List<List<String>> rows = new ArrayList<>();
        for (List<String> row : table.rows()) {
            if (metricKey.equals(row.get(1))) {
                rows.add(row);
            }
        }
        return rows;
    }
}
