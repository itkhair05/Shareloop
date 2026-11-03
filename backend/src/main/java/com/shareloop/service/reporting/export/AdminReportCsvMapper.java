package com.shareloop.service.reporting.export;

import com.shareloop.dto.reporting.CategoryDistributionItem;
import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ModerationSummaryResponse;
import com.shareloop.dto.reporting.ReportDistributionItem;
import com.shareloop.dto.reporting.ReportPeriodResponse;
import com.shareloop.dto.reporting.ReportTimeseriesPoint;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.ReviewsSummaryResponse;
import com.shareloop.dto.reporting.SupportOpenWorkloadResponse;
import com.shareloop.dto.reporting.SupportSummaryResponse;
import com.shareloop.dto.reporting.TopRequestedListingItem;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.TransactionsSummaryResponse;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Component
public class AdminReportCsvMapper {

    private static final List<String> SUMMARY_HEADERS = List.of(
            "section",
            "metric_key",
            "metric_label_vi",
            "dimension_key",
            "dimension_label_vi",
            "value",
            "period_from",
            "period_to",
            "timezone",
            "filters",
            "generated_at"
    );

    private static final List<String> TIMESERIES_HEADERS = List.of(
            "section",
            "metric_key",
            "metric_label_vi",
            "bucket_start",
            "value",
            "period_from",
            "period_to",
            "timezone",
            "granularity",
            "filters",
            "generated_at"
    );

    private static final List<String> TOP_REQUESTED_HEADERS = List.of(
            "rank",
            "listing_id",
            "listing_title",
            "owner_id",
            "owner_display_name",
            "category_id",
            "category_name",
            "listing_type",
            "request_count",
            "period_from",
            "period_to",
            "timezone",
            "filters",
            "generated_at"
    );

    private static final Map<String, String> METRIC_LABELS = Map.ofEntries(
            Map.entry("USER_REGISTRATIONS", "Người dùng đăng ký mới"),
            Map.entry("USER_ROLE_DISTRIBUTION", "Người dùng theo vai trò"),
            Map.entry("USER_STATUS_DISTRIBUTION", "Người dùng theo trạng thái hiện tại"),
            Map.entry("LISTING_CREATIONS", "Tin đăng mới"),
            Map.entry("LISTING_STATUS_DISTRIBUTION", "Tin đăng theo trạng thái hiện tại"),
            Map.entry("LISTING_TYPE_DISTRIBUTION", "Tin đăng theo loại"),
            Map.entry("LISTING_CATEGORY_DISTRIBUTION", "Tin đăng theo danh mục"),
            Map.entry("TRANSACTION_CREATIONS", "Giao dịch mới"),
            Map.entry("TRANSACTION_STATUS_DISTRIBUTION", "Giao dịch theo trạng thái hiện tại"),
            Map.entry("MODERATION_REPORT_CREATIONS", "Báo cáo vi phạm mới"),
            Map.entry("MODERATION_STATUS_DISTRIBUTION", "Báo cáo vi phạm theo trạng thái hiện tại"),
            Map.entry("MODERATION_CATEGORY_DISTRIBUTION", "Báo cáo vi phạm theo danh mục"),
            Map.entry("MODERATION_TARGET_TYPE_DISTRIBUTION", "Báo cáo vi phạm theo loại đối tượng"),
            Map.entry("REVIEW_CREATIONS", "Đánh giá mới"),
            Map.entry("REVIEWS_VISIBLE", "Đánh giá đang hiển thị"),
            Map.entry("REVIEWS_HIDDEN", "Đánh giá đang bị ẩn"),
            Map.entry("REVIEWS_AVERAGE_RATING_VISIBLE", "Điểm trung bình đánh giá đang hiển thị"),
            Map.entry("REVIEWS_AVERAGE_RATING_ALL", "Điểm trung bình tất cả đánh giá"),
            Map.entry("REVIEW_RATING_DISTRIBUTION_ALL", "Phân bố điểm đánh giá (tất cả)"),
            Map.entry("REVIEW_RATING_DISTRIBUTION_VISIBLE", "Phân bố điểm đánh giá (đang hiển thị)"),
            Map.entry("SUPPORT_REQUEST_CREATIONS", "Yêu cầu hỗ trợ mới"),
            Map.entry("SUPPORT_STATUS_DISTRIBUTION", "Yêu cầu hỗ trợ theo trạng thái hiện tại"),
            Map.entry("SUPPORT_CATEGORY_DISTRIBUTION", "Yêu cầu hỗ trợ theo danh mục"),
            Map.entry("SUPPORT_CURRENT_OPEN_WORKLOAD", "Yêu cầu hỗ trợ đang mở (toàn hệ thống, mọi ngày)"),
            Map.entry("SUPPORT_CURRENT_OPEN_WORKLOAD_SCOPE", "Phạm vi số liệu yêu cầu hỗ trợ đang mở"),
            Map.entry("SUPPORT_CURRENT_OPEN_WORKLOAD_AS_OF", "Thời điểm chụp số liệu yêu cầu hỗ trợ đang mở"),
            Map.entry("USERS_CREATED", "Người dùng đăng ký mới"),
            Map.entry("USERS_BY_ROLE", "Người dùng theo vai trò"),
            Map.entry("USERS_BY_CURRENT_STATUS", "Người dùng theo trạng thái hiện tại"),
            Map.entry("LISTINGS_CREATED", "Tin đăng mới"),
            Map.entry("LISTINGS_BY_CURRENT_STATUS", "Tin đăng theo trạng thái hiện tại"),
            Map.entry("LISTINGS_BY_TYPE", "Tin đăng theo loại"),
            Map.entry("LISTINGS_BY_CATEGORY", "Tin đăng theo danh mục"),
            Map.entry("TRANSACTIONS_CREATED", "Giao dịch mới"),
            Map.entry("TRANSACTIONS_BY_CURRENT_STATUS", "Giao dịch theo trạng thái hiện tại"),
            Map.entry("MODERATION_REPORTS_CREATED", "Báo cáo vi phạm mới"),
            Map.entry("MODERATION_BY_CURRENT_STATUS", "Báo cáo vi phạm theo trạng thái hiện tại"),
            Map.entry("MODERATION_BY_CATEGORY", "Báo cáo vi phạm theo danh mục"),
            Map.entry("MODERATION_BY_TARGET_TYPE", "Báo cáo vi phạm theo loại đối tượng"),
            Map.entry("REVIEWS_CREATED", "Đánh giá mới"),
            Map.entry("REVIEWS_BY_VISIBILITY", "Đánh giá theo hiển thị"),
            Map.entry("REVIEWS_BY_RATING_ALL", "Phân bố điểm đánh giá (tất cả)"),
            Map.entry("REVIEWS_BY_RATING_VISIBLE", "Phân bố điểm đánh giá (đang hiển thị)"),
            Map.entry("SUPPORT_REQUESTS_CREATED", "Yêu cầu hỗ trợ mới"),
            Map.entry("SUPPORT_BY_CURRENT_STATUS", "Yêu cầu hỗ trợ theo trạng thái hiện tại"),
            Map.entry("SUPPORT_BY_CATEGORY", "Yêu cầu hỗ trợ theo danh mục")
    );

    public CsvTable overviewSummary(
            ReportingOverviewResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "USERS_CREATED", "TOTAL", "Tổng", Long.toString(response.users().totalUsers())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "USERS_BY_ROLE", response.users().byRole(), this::userRoleLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "USERS_BY_CURRENT_STATUS", response.users().byStatus(), this::userStatusLabel);

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "LISTINGS_CREATED", "TOTAL", "Tổng", Long.toString(response.listings().totalListings())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "LISTINGS_BY_CURRENT_STATUS", response.listings().byStatus(), this::listingStatusLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "LISTINGS_BY_TYPE", response.listings().byType(), this::listingTypeLabel);
        addCategoryDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "LISTINGS_BY_CATEGORY", response.listings().byCategory());

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "TRANSACTIONS_CREATED", "TOTAL", "Tổng", Long.toString(response.transactions().totalTransactions())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "TRANSACTIONS_BY_CURRENT_STATUS", response.transactions().byStatus(), this::transactionStatusLabel);

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "MODERATION_REPORTS_CREATED", "TOTAL", "Tổng", Long.toString(response.moderation().totalReports())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "MODERATION_BY_CURRENT_STATUS", response.moderation().byStatus(), this::reportStatusLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "MODERATION_BY_CATEGORY", response.moderation().byCategory(), this::reportCategoryLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "MODERATION_BY_TARGET_TYPE", response.moderation().byTargetType(), this::reportTargetTypeLabel);

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_CREATED", "TOTAL", "Tổng", Long.toString(response.reviews().totalReviews())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_BY_VISIBILITY", List.of(
                        new ReportDistributionItem("VISIBLE", response.reviews().visibleReviews()),
                        new ReportDistributionItem("HIDDEN", response.reviews().hiddenReviews())
                ), this::visibilityLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_BY_RATING_ALL", response.reviews().ratingDistributionAll(), this::ratingLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_BY_RATING_VISIBLE", response.reviews().ratingDistributionVisible(), this::ratingLabel);
        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_AVERAGE_RATING_VISIBLE", "TOTAL", "Tổng",
                formatDecimal(response.reviews().averageRatingVisible())));
        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "REVIEWS_AVERAGE_RATING_ALL", "TOTAL", "Tổng",
                formatDecimal(response.reviews().averageRatingAll())));

        rows.add(summaryRow(AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "SUPPORT_REQUESTS_CREATED", "TOTAL", "Tổng", Long.toString(response.support().totalSupportRequests())));
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "SUPPORT_BY_CURRENT_STATUS", response.support().byCurrentStatus(), this::supportStatusLabel);
        addDistribution(rows, AdminReportExportSection.OVERVIEW, period, filtersJson, generatedAt,
                "SUPPORT_BY_CATEGORY", response.support().byCategory(), this::supportCategoryLabel);

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable usersSummary(
            UsersSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.USERS, period, filtersJson, generatedAt,
                "USER_REGISTRATIONS", "TOTAL", "Tổng", Long.toString(response.metrics().totalUsers())));
        addDistribution(rows, AdminReportExportSection.USERS, period, filtersJson, generatedAt,
                "USER_ROLE_DISTRIBUTION", response.metrics().byRole(), this::userRoleLabel);
        addDistribution(rows, AdminReportExportSection.USERS, period, filtersJson, generatedAt,
                "USER_STATUS_DISTRIBUTION", response.metrics().byStatus(), this::userStatusLabel);

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable listingsSummary(
            ListingsSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.LISTINGS, period, filtersJson, generatedAt,
                "LISTING_CREATIONS", "TOTAL", "Tổng", Long.toString(response.metrics().totalListings())));
        addDistribution(rows, AdminReportExportSection.LISTINGS, period, filtersJson, generatedAt,
                "LISTING_STATUS_DISTRIBUTION", response.metrics().byStatus(), this::listingStatusLabel);
        addDistribution(rows, AdminReportExportSection.LISTINGS, period, filtersJson, generatedAt,
                "LISTING_TYPE_DISTRIBUTION", response.metrics().byType(), this::listingTypeLabel);
        addCategoryDistribution(rows, AdminReportExportSection.LISTINGS, period, filtersJson, generatedAt,
                "LISTING_CATEGORY_DISTRIBUTION", response.metrics().byCategory());

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable transactionsSummary(
            TransactionsSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.TRANSACTIONS, period, filtersJson, generatedAt,
                "TRANSACTION_CREATIONS", "TOTAL", "Tổng",
                Long.toString(response.metrics().totalTransactions())));
        addDistribution(rows, AdminReportExportSection.TRANSACTIONS, period, filtersJson, generatedAt,
                "TRANSACTION_STATUS_DISTRIBUTION", response.metrics().byStatus(), this::transactionStatusLabel);

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable moderationSummary(
            ModerationSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.MODERATION, period, filtersJson, generatedAt,
                "MODERATION_REPORT_CREATIONS", "TOTAL", "Tổng",
                Long.toString(response.metrics().totalReports())));
        addDistribution(rows, AdminReportExportSection.MODERATION, period, filtersJson, generatedAt,
                "MODERATION_STATUS_DISTRIBUTION", response.metrics().byStatus(), this::reportStatusLabel);
        addDistribution(rows, AdminReportExportSection.MODERATION, period, filtersJson, generatedAt,
                "MODERATION_CATEGORY_DISTRIBUTION", response.metrics().byCategory(), this::reportCategoryLabel);
        addDistribution(rows, AdminReportExportSection.MODERATION, period, filtersJson, generatedAt,
                "MODERATION_TARGET_TYPE_DISTRIBUTION", response.metrics().byTargetType(), this::reportTargetTypeLabel);

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable reviewsSummary(
            ReviewsSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEW_CREATIONS", "TOTAL", "Tổng", Long.toString(response.metrics().totalReviews())));
        rows.add(summaryRow(AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEWS_VISIBLE", "TOTAL", "Tổng", Long.toString(response.metrics().visibleReviews())));
        rows.add(summaryRow(AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEWS_HIDDEN", "TOTAL", "Tổng", Long.toString(response.metrics().hiddenReviews())));
        rows.add(summaryRow(AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEWS_AVERAGE_RATING_VISIBLE", "TOTAL", "Tổng",
                formatDecimal(response.metrics().averageRatingVisible())));
        rows.add(summaryRow(AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEWS_AVERAGE_RATING_ALL", "TOTAL", "Tổng",
                formatDecimal(response.metrics().averageRatingAll())));
        addDistribution(rows, AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEW_RATING_DISTRIBUTION_ALL", response.metrics().ratingDistributionAll(), this::ratingLabel);
        addDistribution(rows, AdminReportExportSection.REVIEWS, period, filtersJson, generatedAt,
                "REVIEW_RATING_DISTRIBUTION_VISIBLE", response.metrics().ratingDistributionVisible(), this::ratingLabel);

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable supportSummary(
            SupportSummaryResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                "SUPPORT_REQUEST_CREATIONS", "TOTAL", "Tổng",
                Long.toString(response.metrics().totalSupportRequests())));
        addDistribution(rows, AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                "SUPPORT_STATUS_DISTRIBUTION", response.metrics().byCurrentStatus(), this::supportStatusLabel);
        addDistribution(rows, AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                "SUPPORT_CATEGORY_DISTRIBUTION", response.metrics().byCategory(), this::supportCategoryLabel);

        SupportOpenWorkloadResponse workload = response.currentOpenWorkload();
        if (workload != null) {
            rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                    "SUPPORT_CURRENT_OPEN_WORKLOAD", "PENDING", "Chờ xử lý",
                    Long.toString(workload.pending())));
            rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                    "SUPPORT_CURRENT_OPEN_WORKLOAD", "IN_PROGRESS", "Đang xử lý",
                    Long.toString(workload.inProgress())));
            rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                    "SUPPORT_CURRENT_OPEN_WORKLOAD", "TOTAL_OPEN", "Tổng đang mở",
                    Long.toString(workload.totalOpen())));
            rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                    "SUPPORT_CURRENT_OPEN_WORKLOAD_SCOPE", "SYSTEM_WIDE", "Toàn hệ thống",
                    workload.scope()));
            rows.add(summaryRow(AdminReportExportSection.SUPPORT, period, filtersJson, generatedAt,
                    "SUPPORT_CURRENT_OPEN_WORKLOAD_AS_OF", "SNAPSHOT", "Thời điểm chụp",
                    workload.asOf() == null ? null : workload.asOf().toString()));
        }

        return new CsvTable(SUMMARY_HEADERS, rows);
    }

    public CsvTable timeseries(
            AdminReportExportSection section,
            ReportTimeseriesResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        for (ReportTimeseriesPoint point : response.points()) {
            rows.add(Arrays.asList(
                    section.pathValue(),
                    response.metric(),
                    metricLabel(response.metric()),
                    point.bucketStart().toString(),
                    Long.toString(point.value()),
                    period.from().toString(),
                    period.to().toString(),
                    CsvFormulaProtection.protect(period.timezone()),
                    response.granularity(),
                    CsvFormulaProtection.protect(filtersJson),
                    generatedAt
            ));
        }

        return new CsvTable(TIMESERIES_HEADERS, rows);
    }

    public CsvTable topRequested(
            TopRequestedListingsResponse response,
            String filtersJson,
            String generatedAt
    ) {
        ReportPeriodResponse period = response.period();
        List<List<String>> rows = new ArrayList<>();

        if (response.listings() == null || response.listings().isEmpty()) {
            rows.add(Arrays.asList(
                    "",
                    "",
                    "Không có dữ liệu trong kỳ",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    period.from().toString(),
                    period.to().toString(),
                    CsvFormulaProtection.protect(period.timezone()),
                    CsvFormulaProtection.protect(filtersJson),
                    generatedAt
            ));
            return new CsvTable(TOP_REQUESTED_HEADERS, rows);
        }

        int rank = 1;
        for (TopRequestedListingItem item : response.listings()) {
            rows.add(Arrays.asList(
                    Integer.toString(rank++),
                    item.listingId() == null ? "" : item.listingId().toString(),
                    item.title() == null ? "" : CsvFormulaProtection.protect(item.title()),
                    item.ownerId() == null ? "" : item.ownerId().toString(),
                    item.ownerDisplayName() == null ? "" : CsvFormulaProtection.protect(item.ownerDisplayName()),
                    item.categoryId() == null ? "" : item.categoryId().toString(),
                    item.categoryName() == null ? "" : CsvFormulaProtection.protect(item.categoryName()),
                    item.listingType() == null ? "" : item.listingType().name(),
                    Long.toString(item.requestCount()),
                    period.from().toString(),
                    period.to().toString(),
                    CsvFormulaProtection.protect(period.timezone()),
                    CsvFormulaProtection.protect(filtersJson),
                    generatedAt
            ));
        }

        return new CsvTable(TOP_REQUESTED_HEADERS, rows);
    }

    private List<String> summaryRow(
            AdminReportExportSection section,
            ReportPeriodResponse period,
            String filtersJson,
            String generatedAt,
            String metricKey,
            String dimensionKey,
            String dimensionLabel,
            String value
    ) {
        return Arrays.asList(
                section.pathValue(),
                metricKey,
                metricLabel(metricKey),
                dimensionKey == null ? "" : dimensionKey,
                dimensionLabel == null ? "" : dimensionLabel,
                value,
                period.from().toString(),
                period.to().toString(),
                CsvFormulaProtection.protect(period.timezone()),
                CsvFormulaProtection.protect(filtersJson),
                generatedAt
        );
    }

    private void addDistribution(
            List<List<String>> rows,
            AdminReportExportSection section,
            ReportPeriodResponse period,
            String filtersJson,
            String generatedAt,
            String metricKey,
            List<ReportDistributionItem> items,
            Function<String, String> dimensionLabelResolver
    ) {
        if (items == null) {
            return;
        }
        for (ReportDistributionItem item : items) {
            rows.add(summaryRow(
                    section,
                    period,
                    filtersJson,
                    generatedAt,
                    metricKey,
                    item.key(),
                    dimensionLabelResolver.apply(item.key()),
                    Long.toString(item.value())
            ));
        }
    }

    private void addCategoryDistribution(
            List<List<String>> rows,
            AdminReportExportSection section,
            ReportPeriodResponse period,
            String filtersJson,
            String generatedAt,
            String metricKey,
            List<CategoryDistributionItem> items
    ) {
        if (items == null) {
            return;
        }
        for (CategoryDistributionItem item : items) {
            rows.add(summaryRow(
                    section,
                    period,
                    filtersJson,
                    generatedAt,
                    metricKey,
                    item.categoryId() == null ? "" : item.categoryId().toString(),
                    item.categoryName() == null ? "" : CsvFormulaProtection.protect(item.categoryName()),
                    Long.toString(item.value())
            ));
        }
    }

    private String metricLabel(String metricKey) {
        return METRIC_LABELS.getOrDefault(metricKey, metricKey);
    }

    private String formatDecimal(Double value) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private String userRoleLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "USER" -> "Người dùng";
            case "ADMIN" -> "Quản trị viên";
            default -> key;
        };
    }

    private String userStatusLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "ACTIVE" -> "Đang hoạt động";
            case "SUSPENDED" -> "Tạm khóa";
            case "DEACTIVATED" -> "Ngừng hoạt động";
            default -> key;
        };
    }

    private String listingStatusLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "DRAFT" -> "Bản nháp";
            case "ACTIVE" -> "Đang hiển thị";
            case "RESERVED" -> "Đã giữ chỗ";
            case "COMPLETED" -> "Đã hoàn tất";
            case "CANCELLED" -> "Đã hủy";
            case "REMOVED" -> "Đã gỡ";
            default -> key;
        };
    }

    private String listingTypeLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "GIVEAWAY" -> "Cho tặng";
            case "SALE" -> "Thanh lý";
            case "WANTED" -> "Cần tìm";
            default -> key;
        };
    }

    private String transactionStatusLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "PENDING" -> "Chờ bàn giao";
            case "IN_PROGRESS" -> "Đang thực hiện";
            case "COMPLETED" -> "Đã hoàn tất";
            case "CANCELLED" -> "Đã hủy";
            default -> key;
        };
    }

    private String reportStatusLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "PENDING" -> "Chờ xử lý";
            case "INVESTIGATING" -> "Đang điều tra";
            case "RESOLVED" -> "Đã xử lý";
            case "DISMISSED" -> "Đã bỏ qua";
            default -> key;
        };
    }

    private String reportCategoryLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "FRAUD_OR_SCAM" -> "Lừa đảo";
            case "HARASSMENT" -> "Quấy rối";
            case "ITEM_MISREPRESENTED" -> "Hàng không đúng mô tả";
            case "NO_SHOW_OR_UNRESPONSIVE" -> "Không phản hồi hoặc không đến";
            case "PROHIBITED_ITEM" -> "Hàng hóa bị cấm";
            case "OTHER" -> "Khác";
            default -> key;
        };
    }

    private String reportTargetTypeLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "USER" -> "Người dùng";
            case "LISTING" -> "Tin đăng";
            case "TRANSACTION" -> "Giao dịch";
            case "REVIEW" -> "Đánh giá";
            default -> key;
        };
    }

    private String supportStatusLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "PENDING" -> "Chờ xử lý";
            case "IN_PROGRESS" -> "Đang xử lý";
            case "RESOLVED" -> "Đã xử lý";
            case "CLOSED" -> "Đã đóng";
            default -> key;
        };
    }

    private String supportCategoryLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "TRANSACTION_ISSUE" -> "Vấn đề giao dịch";
            case "ACCOUNT_ISSUE" -> "Vấn đề tài khoản";
            case "SAFETY_CONCERN" -> "Lo ngại an toàn";
            case "OTHER" -> "Khác";
            default -> key;
        };
    }

    private String ratingLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "1" -> "1 sao";
            case "2" -> "2 sao";
            case "3" -> "3 sao";
            case "4" -> "4 sao";
            case "5" -> "5 sao";
            default -> key;
        };
    }

    private String visibilityLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "VISIBLE" -> "Đang hiển thị";
            case "HIDDEN" -> "Đang bị ẩn";
            default -> key;
        };
    }
}
