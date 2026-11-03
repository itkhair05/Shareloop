package com.shareloop.service.reporting.export;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.service.reporting.AdminReportAggregationService;
import com.shareloop.service.reporting.AdminReportFilter;
import com.shareloop.service.reporting.ReportDateRange;
import com.shareloop.service.reporting.ReportGranularity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminReportCsvExportServiceTest {

    private static final ReportDateRange RANGE = new ReportDateRange(
            LocalDate.of(2026, 1, 1),
            LocalDate.of(2026, 1, 8),
            ZoneId.of("Asia/Ho_Chi_Minh")
    );
    private static final ReportPeriodResponse PERIOD = ReportPeriodResponse.from(RANGE);
    private static final String CATEGORY_ID = "11111111-1111-1111-1111-111111111111";

    @Mock
    private AdminReportAggregationService aggregationService;

    private AdminReportCsvExportService service;

    @BeforeEach
    void setUp() {
        service = new AdminReportCsvExportService(
                aggregationService,
                new AdminReportCsvMapper(),
                new CsvWriter(),
                new ObjectMapper()
        );
    }

    @Test
    @DisplayName("Missing dataset defaults to summary and applies role and status filters")
    void summaryDefaultsAndPassesFilters() {
        when(aggregationService.getUsersSummary(any())).thenReturn(new UsersSummaryResponse(
                PERIOD,
                new UsersReportMetrics(
                        2,
                        List.of(
                                new ReportDistributionItem("USER", 2),
                                new ReportDistributionItem("ADMIN", 0)
                        ),
                        List.of(
                                new ReportDistributionItem("ACTIVE", 2),
                                new ReportDistributionItem("SUSPENDED", 0),
                                new ReportDistributionItem("DEACTIVATED", 0)
                        )
                ),
                "semantics"
        ));

        AdminReportCsvExportResult result = service.export(
                new RequestBuilder(AdminReportExportSection.USERS, null)
                        .role(UserRole.USER)
                        .status("ACTIVE")
                        .build()
        );

        assertThat(result.filename())
                .isEqualTo("shareloop-report-users-2026-01-01-2026-01-08.csv");
        assertThat(result.content()[0]).isEqualTo((byte) 0xEF);
        assertThat(result.content()[1]).isEqualTo((byte) 0xBB);
        assertThat(result.content()[2]).isEqualTo((byte) 0xBF);

        ArgumentCaptor<AdminReportFilter> filterCaptor = ArgumentCaptor.forClass(AdminReportFilter.class);
        verify(aggregationService).getUsersSummary(filterCaptor.capture());
        assertThat(filterCaptor.getValue().userRole()).isEqualTo(UserRole.USER);
        assertThat(filterCaptor.getValue().userStatus()).isEqualTo(UserStatus.ACTIVE);

        String content = new String(result.content(), StandardCharsets.UTF_8);
        assertThat(content).contains("USER_REGISTRATIONS");
        assertThat(parseCsv(result.content()).get(1).get(9))
                .isEqualTo("{\"role\":\"USER\",\"status\":\"ACTIVE\"}");
    }

    @Test
    @DisplayName("Time series defaults to DAY and forwards typed filters")
    void timeseriesDefaultsToDayAndPassesFilters() {
        when(aggregationService.getModerationTimeseries(
                eq(RANGE), eq(ReportGranularity.DAY),
                eq(ReportCategory.FRAUD_OR_SCAM), eq(ReportTargetType.USER)
        )).thenReturn(new ReportTimeseriesResponse(
                "MODERATION_REPORT_CREATIONS",
                PERIOD,
                "DAY",
                List.of(new ReportTimeseriesPoint(LocalDate.of(2026, 1, 1), 3))
        ));

        AdminReportCsvExportResult result = service.export(
                new RequestBuilder(
                        AdminReportExportSection.MODERATION,
                        AdminReportExportDataset.TIMESERIES
                )
                        .category("FRAUD_OR_SCAM")
                        .targetType(ReportTargetType.USER)
                        .build()
        );

        assertThat(result.filename()).isEqualTo(
                "shareloop-report-moderation-2026-01-01-2026-01-08.csv"
        );

        List<List<String>> rows = parseCsv(result.content());
        assertThat(rows.get(1).get(0)).isEqualTo("moderation");
        assertThat(rows.get(1).get(2)).isEqualTo("Báo cáo vi phạm mới");
        assertThat(rows.get(1).get(3)).isEqualTo("2026-01-01");
        assertThat(rows.get(1).get(4)).isEqualTo("3");
        assertThat(rows.get(1).get(8)).isEqualTo("DAY");
        assertThat(rows.get(1).get(9)).isEqualTo(
                "{\"category\":\"FRAUD_OR_SCAM\",\"targetType\":\"USER\"}"
        );

        verify(aggregationService).getModerationTimeseries(
                RANGE, ReportGranularity.DAY, ReportCategory.FRAUD_OR_SCAM, ReportTargetType.USER
        );
    }

    @Test
    @DisplayName("Top requested forwards the limit and serializes ranking metadata deterministically")
    void topRequestedIncludesLimitAndCountedStatuses() {
        UUID categoryId = UUID.fromString(CATEGORY_ID);
        when(aggregationService.getTopRequestedListings(RANGE, 5, categoryId))
                .thenReturn(new TopRequestedListingsResponse(
                        PERIOD,
                        5,
                        List.of("PENDING", "ACCEPTED", "REJECTED"),
                        List.of(new TopRequestedListingItem(
                                UUID.fromString("22222222-2222-2222-2222-222222222222"),
                                "Bàn phím cơ",
                                UUID.fromString("33333333-3333-3333-3333-333333333333"),
                                "Nguyễn Văn A",
                                categoryId,
                                "Điện tử",
                                ListingType.SALE,
                                4
                        ))
                ));

        AdminReportCsvExportResult result = service.export(
                new RequestBuilder(
                        AdminReportExportSection.LISTINGS,
                        AdminReportExportDataset.TOP_REQUESTED
                )
                        .categoryId(categoryId)
                        .limit(5)
                        .build()
        );

        List<List<String>> rows = parseCsv(result.content());
        assertThat(rows).hasSize(2);
        assertThat(rows.get(1).get(0)).isEqualTo("1");
        assertThat(rows.get(1).get(2)).isEqualTo("Bàn phím cơ");
        assertThat(rows.get(1).get(8)).isEqualTo("4");
        assertThat(rows.get(1).get(12)).isEqualTo(
                "{\"categoryId\":\"" + CATEGORY_ID + "\","
                        + "\"countedRequestStatuses\":[\"PENDING\",\"ACCEPTED\",\"REJECTED\"],"
                        + "\"limit\":5}"
        );

        verify(aggregationService).getTopRequestedListings(RANGE, 5, categoryId);
    }

    @Test
    @DisplayName("Overview supports summary only")
    void overviewRejectsOtherDatasets() {
        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.OVERVIEW, AdminReportExportDataset.TIMESERIES).build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not supported");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.OVERVIEW, AdminReportExportDataset.TOP_REQUESTED).build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not supported");

        verifyNoInteractions(aggregationService);
    }

    @Test
    @DisplayName("Top requested is available only for listings")
    void topRequestedRejectsOtherSections() {
        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.USERS, AdminReportExportDataset.TOP_REQUESTED).build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not supported");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.REVIEWS, AdminReportExportDataset.TOP_REQUESTED).build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not supported");

        verifyNoInteractions(aggregationService);
    }

    @Test
    @DisplayName("Parameters that the underlying section does not support are rejected before querying")
    void rejectsUnsupportedParameters() {
        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.USERS, AdminReportExportDataset.SUMMARY)
                        .granularity(ReportGranularity.DAY)
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("granularity");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.USERS, AdminReportExportDataset.TIMESERIES)
                        .status("ACTIVE")
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("status");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.REVIEWS, AdminReportExportDataset.SUMMARY)
                        .category("OTHER")
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("category");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.LISTINGS, AdminReportExportDataset.TOP_REQUESTED)
                        .status("ACTIVE")
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("status");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.LISTINGS, AdminReportExportDataset.SUMMARY)
                        .limit(5)
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("limit");

        verifyNoInteractions(aggregationService);
    }

    @Test
    @DisplayName("Unsupported enum values are rejected with a validation error")
    void rejectsUnsupportedEnumValues() {
        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.USERS, AdminReportExportDataset.SUMMARY)
                        .status("ARCHIVED")
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("status");

        assertThatThrownBy(() -> service.export(
                new RequestBuilder(AdminReportExportSection.MODERATION, AdminReportExportDataset.SUMMARY)
                        .category("NOT_A_CATEGORY")
                        .build()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("category");

        verifyNoInteractions(aggregationService);
    }

    @Test
    @DisplayName("Every supported section and dataset delegates to the existing aggregation service")
    void everySupportedSectionAndDatasetIsExported() {
        when(aggregationService.getOverview(RANGE)).thenReturn(overviewResponse());
        when(aggregationService.getUsersSummary(any())).thenReturn(new UsersSummaryResponse(
                PERIOD, new UsersReportMetrics(1, List.of(), List.of()), "semantics"));
        when(aggregationService.getListingsSummary(any())).thenReturn(new ListingsSummaryResponse(
                PERIOD, new ListingsReportMetrics(1, List.of(), List.of(), List.of()), "semantics"));
        when(aggregationService.getTransactionsSummary(any())).thenReturn(new TransactionsSummaryResponse(
                PERIOD, new TransactionsReportMetrics(1, List.of()), "semantics"));
        when(aggregationService.getModerationSummary(any())).thenReturn(new ModerationSummaryResponse(
                PERIOD, new ModerationReportMetrics(1, List.of(), List.of(), List.of()), "semantics"));
        when(aggregationService.getReviewsSummary(RANGE)).thenReturn(new ReviewsSummaryResponse(
                PERIOD, new ReviewsReportMetrics(1, 1, 0, null, null, List.of(), List.of()), "semantics"));
        when(aggregationService.getSupportSummary(any())).thenReturn(supportResponse());

        when(aggregationService.getUsersTimeseries(RANGE, ReportGranularity.DAY))
                .thenReturn(timeseriesResponse("USER_REGISTRATIONS"));
        when(aggregationService.getListingsTimeseries(RANGE, ReportGranularity.DAY, null, null))
                .thenReturn(timeseriesResponse("LISTING_CREATIONS"));
        when(aggregationService.getTransactionsTimeseries(RANGE, ReportGranularity.DAY))
                .thenReturn(timeseriesResponse("TRANSACTION_CREATIONS"));
        when(aggregationService.getModerationTimeseries(RANGE, ReportGranularity.DAY, null, null))
                .thenReturn(timeseriesResponse("MODERATION_REPORT_CREATIONS"));
        when(aggregationService.getReviewsTimeseries(RANGE, ReportGranularity.DAY))
                .thenReturn(timeseriesResponse("REVIEW_CREATIONS"));
        when(aggregationService.getSupportTimeseries(RANGE, ReportGranularity.DAY, null, null))
                .thenReturn(timeseriesResponse("SUPPORT_REQUEST_CREATIONS"));
        when(aggregationService.getTopRequestedListings(RANGE, null, null))
                .thenReturn(new TopRequestedListingsResponse(
                        PERIOD, 10, List.of("PENDING", "ACCEPTED", "REJECTED"), List.of()));

        for (String section : List.of(
                "overview", "users", "listings", "transactions", "moderation", "reviews", "support"
        )) {
            AdminReportCsvExportResult result = service.export(
                    new RequestBuilder(AdminReportExportSection.from(section), null).build()
            );
            assertThat(result.filename()).isEqualTo(
                    "shareloop-report-" + section + "-2026-01-01-2026-01-08.csv"
            );
            assertThat(result.content().length).isGreaterThan(3);
        }

        for (String section : List.of(
                "users", "listings", "transactions", "moderation", "reviews", "support"
        )) {
            AdminReportCsvExportResult result = service.export(
                    new RequestBuilder(
                            AdminReportExportSection.from(section),
                            AdminReportExportDataset.TIMESERIES
                    ).build()
            );
            assertThat(new String(result.content(), StandardCharsets.UTF_8)).contains("DAY");
        }

        AdminReportCsvExportResult topRequested = service.export(
                new RequestBuilder(
                        AdminReportExportSection.LISTINGS,
                        AdminReportExportDataset.TOP_REQUESTED
                ).build()
        );
        assertThat(new String(topRequested.content(), StandardCharsets.UTF_8))
                .contains("Không có dữ liệu trong kỳ");
    }

    private static ReportingOverviewResponse overviewResponse() {
        return new ReportingOverviewResponse(
                PERIOD,
                List.of("USERS", "LISTINGS", "TRANSACTIONS", "MODERATION", "REVIEWS", "SUPPORT"),
                List.of("USERS_CREATED"),
                new UsersReportMetrics(1, List.of(), List.of()),
                new ListingsReportMetrics(1, List.of(), List.of(), List.of()),
                new TransactionsReportMetrics(1, List.of()),
                new ModerationReportMetrics(1, List.of(), List.of(), List.of()),
                new ReviewsReportMetrics(1, 1, 0, null, null, List.of(), List.of()),
                new SupportReportMetrics(1, List.of(), List.of()),
                "disclaimer"
        );
    }

    private static SupportSummaryResponse supportResponse() {
        return new SupportSummaryResponse(
                PERIOD,
                new SupportReportMetrics(1, List.of(), List.of()),
                "semantics",
                new SupportOpenWorkloadResponse(
                        java.time.Instant.EPOCH, "CURRENT_SYSTEM_WIDE_ALL_DATES", 0, 0, 0
                )
        );
    }

    private static ReportTimeseriesResponse timeseriesResponse(String metric) {
        return new ReportTimeseriesResponse(
                metric,
                PERIOD,
                "DAY",
                List.of(new ReportTimeseriesPoint(LocalDate.of(2026, 1, 1), 1))
        );
    }

    private static List<List<String>> parseCsv(byte[] bytes) {
        String content = new String(bytes, StandardCharsets.UTF_8);
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }

        List<List<String>> rows = new java.util.ArrayList<>();
        List<String> row = new java.util.ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;

        for (int index = 0; index < content.length(); index++) {
            char character = content.charAt(index);
            if (quoted) {
                if (character == '"') {
                    if (index + 1 < content.length() && content.charAt(index + 1) == '"') {
                        cell.append('"');
                        index++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell.append(character);
                }
            } else if (character == '"') {
                quoted = true;
            } else if (character == ',') {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (character == '\r' && index + 1 < content.length() && content.charAt(index + 1) == '\n') {
                row.add(cell.toString());
                cell.setLength(0);
                rows.add(row);
                row = new java.util.ArrayList<>();
                index++;
            } else {
                cell.append(character);
            }
        }

        if (!row.isEmpty() || cell.length() > 0) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }

    private static final class RequestBuilder {

        private final AdminReportExportSection section;
        private final AdminReportExportDataset dataset;
        private UserRole role;
        private String status;
        private String category;
        private ListingType listingType;
        private ReportTargetType targetType;
        private UUID categoryId;
        private ReportGranularity granularity;
        private Integer limit;

        private RequestBuilder(AdminReportExportSection section, AdminReportExportDataset dataset) {
            this.section = section;
            this.dataset = dataset;
        }

        private RequestBuilder role(UserRole role) {
            this.role = role;
            return this;
        }

        private RequestBuilder status(String status) {
            this.status = status;
            return this;
        }

        private RequestBuilder category(String category) {
            this.category = category;
            return this;
        }

        private RequestBuilder listingType(ListingType listingType) {
            this.listingType = listingType;
            return this;
        }

        private RequestBuilder targetType(ReportTargetType targetType) {
            this.targetType = targetType;
            return this;
        }

        private RequestBuilder categoryId(UUID categoryId) {
            this.categoryId = categoryId;
            return this;
        }

        private RequestBuilder granularity(ReportGranularity granularity) {
            this.granularity = granularity;
            return this;
        }

        private RequestBuilder limit(Integer limit) {
            this.limit = limit;
            return this;
        }

        private AdminReportCsvExportRequest build() {
            return new AdminReportCsvExportRequest(
                    section, dataset, RANGE, role, listingType, targetType,
                    status, category, categoryId, granularity, limit
            );
        }
    }
}
