package com.shareloop.service.reporting.export;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.service.reporting.AdminReportAggregationService;
import com.shareloop.service.reporting.AdminReportFilter;
import com.shareloop.service.reporting.ReportDateRange;
import com.shareloop.service.reporting.ReportGranularity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Orchestrates aggregate-only CSV exports by delegating every calculation to
 * {@link AdminReportAggregationService}. No record-level data is read here.
 */
@Service
@Transactional(readOnly = true)
public class AdminReportCsvExportService {

    private static final Set<String> NO_PARAMETERS = Set.of();
    private static final DateTimeFormatter GENERATED_AT_FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final AdminReportAggregationService aggregationService;
    private final AdminReportCsvMapper mapper;
    private final CsvWriter csvWriter;
    private final ObjectMapper objectMapper;

    public AdminReportCsvExportService(
            AdminReportAggregationService aggregationService,
            AdminReportCsvMapper mapper,
            CsvWriter csvWriter,
            ObjectMapper objectMapper
    ) {
        this.aggregationService = aggregationService;
        this.mapper = mapper;
        this.csvWriter = csvWriter;
        this.objectMapper = objectMapper;
    }

    public AdminReportCsvExportResult export(AdminReportCsvExportRequest request) {
        AdminReportExportSection section = request.section();
        AdminReportExportDataset dataset = request.dataset() == null
                ? AdminReportExportDataset.SUMMARY
                : request.dataset();

        validateDataset(section, dataset);
        validateParameters(request, dataset);

        ReportDateRange range = request.range();
        String generatedAt = OffsetDateTime.now(range.timezone()).format(GENERATED_AT_FORMAT);
        CsvTable table = buildTable(request, section, dataset, generatedAt);

        String filename = "shareloop-report-" + section.pathValue() + "-"
                + range.from() + "-" + range.to() + ".csv";

        return new AdminReportCsvExportResult(csvWriter.write(table), filename);
    }

    private void validateDataset(AdminReportExportSection section, AdminReportExportDataset dataset) {
        boolean supported = switch (section) {
            case OVERVIEW -> dataset == AdminReportExportDataset.SUMMARY;
            case LISTINGS -> true;
            default -> dataset != AdminReportExportDataset.TOP_REQUESTED;
        };

        if (!supported) {
            throw new IllegalArgumentException(
                    "Dataset '" + dataset.wireValue() + "' is not supported for section '"
                            + section.pathValue() + "'"
            );
        }
    }

    private void validateParameters(AdminReportCsvExportRequest request, AdminReportExportDataset dataset) {
        Set<String> allowed = allowedParameters(request.section(), dataset);

        rejectIfUnsupported(allowed, "role", request.role(), request, dataset);
        rejectIfUnsupported(allowed, "status", request.status(), request, dataset);
        rejectIfUnsupported(allowed, "category", request.category(), request, dataset);
        rejectIfUnsupported(allowed, "listingType", request.listingType(), request, dataset);
        rejectIfUnsupported(allowed, "targetType", request.targetType(), request, dataset);
        rejectIfUnsupported(allowed, "categoryId", request.categoryId(), request, dataset);
        rejectIfUnsupported(allowed, "granularity", request.granularity(), request, dataset);
        rejectIfUnsupported(allowed, "limit", request.limit(), request, dataset);
    }

    private Set<String> allowedParameters(
            AdminReportExportSection section,
            AdminReportExportDataset dataset
    ) {
        return switch (section) {
            case OVERVIEW -> NO_PARAMETERS;
            case USERS -> dataset == AdminReportExportDataset.TIMESERIES
                    ? Set.of("granularity")
                    : Set.of("role", "status");
            case LISTINGS -> switch (dataset) {
                case SUMMARY -> Set.of("status", "listingType", "categoryId");
                case TIMESERIES -> Set.of("granularity", "listingType", "categoryId");
                case TOP_REQUESTED -> Set.of("limit", "categoryId");
            };
            case TRANSACTIONS -> dataset == AdminReportExportDataset.TIMESERIES
                    ? Set.of("granularity")
                    : Set.of("status");
            case MODERATION -> dataset == AdminReportExportDataset.TIMESERIES
                    ? Set.of("granularity", "category", "targetType")
                    : Set.of("status", "category", "targetType");
            case REVIEWS -> dataset == AdminReportExportDataset.TIMESERIES
                    ? Set.of("granularity")
                    : NO_PARAMETERS;
            case SUPPORT -> dataset == AdminReportExportDataset.TIMESERIES
                    ? Set.of("granularity", "status", "category")
                    : Set.of("status", "category");
        };
    }

    private void rejectIfUnsupported(
            Set<String> allowed,
            String parameter,
            Object value,
            AdminReportCsvExportRequest request,
            AdminReportExportDataset dataset
    ) {
        if (value != null && !allowed.contains(parameter)) {
            throw new IllegalArgumentException(
                    "Parameter '" + parameter + "' is not supported for section '"
                            + request.section().pathValue() + "' with dataset '"
                            + dataset.wireValue() + "'"
            );
        }
    }

    private CsvTable buildTable(
            AdminReportCsvExportRequest request,
            AdminReportExportSection section,
            AdminReportExportDataset dataset,
            String generatedAt
    ) {
        ReportDateRange range = request.range();

        return switch (dataset) {
            case SUMMARY -> buildSummaryTable(request, section, range, generatedAt);
            case TIMESERIES -> buildTimeseriesTable(request, section, range, generatedAt);
            case TOP_REQUESTED -> buildTopRequestedTable(request, range, generatedAt);
        };
    }

    private CsvTable buildSummaryTable(
            AdminReportCsvExportRequest request,
            AdminReportExportSection section,
            ReportDateRange range,
            String generatedAt
    ) {
        Map<String, Object> filters = new TreeMap<>();

        return switch (section) {
            case OVERVIEW -> mapper.overviewSummary(
                    aggregationService.getOverview(range),
                    filtersJson(filters),
                    generatedAt
            );
            case USERS -> {
                UserStatus status = parseEnum(UserStatus.class, request.status(), "status", section);
                putFilter(filters, "role", request.role());
                putFilter(filters, "status", status);
                yield mapper.usersSummary(
                        aggregationService.getUsersSummary(
                                AdminReportFilter.forUsers(range, request.role(), status)
                        ),
                        filtersJson(filters),
                        generatedAt
                );
            }
            case LISTINGS -> {
                ListingStatus status = parseEnum(ListingStatus.class, request.status(), "status", section);
                putFilter(filters, "categoryId", request.categoryId());
                putFilter(filters, "listingType", request.listingType());
                putFilter(filters, "status", status);
                yield mapper.listingsSummary(
                        aggregationService.getListingsSummary(
                                AdminReportFilter.forListings(
                                        range, status, request.listingType(), request.categoryId()
                                )
                        ),
                        filtersJson(filters),
                        generatedAt
                );
            }
            case TRANSACTIONS -> {
                TransactionStatus status = parseEnum(
                        TransactionStatus.class, request.status(), "status", section
                );
                putFilter(filters, "status", status);
                yield mapper.transactionsSummary(
                        aggregationService.getTransactionsSummary(
                                AdminReportFilter.forTransactions(range, status)
                        ),
                        filtersJson(filters),
                        generatedAt
                );
            }
            case MODERATION -> {
                ReportStatus status = parseEnum(ReportStatus.class, request.status(), "status", section);
                ReportCategory category = parseEnum(
                        ReportCategory.class, request.category(), "category", section
                );
                putFilter(filters, "category", category);
                putFilter(filters, "status", status);
                putFilter(filters, "targetType", request.targetType());
                yield mapper.moderationSummary(
                        aggregationService.getModerationSummary(
                                AdminReportFilter.forModeration(
                                        range, status, category, request.targetType()
                                )
                        ),
                        filtersJson(filters),
                        generatedAt
                );
            }
            case REVIEWS -> mapper.reviewsSummary(
                    aggregationService.getReviewsSummary(range),
                    filtersJson(filters),
                    generatedAt
            );
            case SUPPORT -> {
                SupportRequestStatus status = parseEnum(
                        SupportRequestStatus.class, request.status(), "status", section
                );
                SupportCategory category = parseEnum(
                        SupportCategory.class, request.category(), "category", section
                );
                putFilter(filters, "category", category);
                putFilter(filters, "status", status);
                yield mapper.supportSummary(
                        aggregationService.getSupportSummary(
                                AdminReportFilter.forSupport(range, status, category)
                        ),
                        filtersJson(filters),
                        generatedAt
                );
            }
        };
    }

    private CsvTable buildTimeseriesTable(
            AdminReportCsvExportRequest request,
            AdminReportExportSection section,
            ReportDateRange range,
            String generatedAt
    ) {
        ReportGranularity granularity = request.granularity() == null
                ? ReportGranularity.DAY
                : request.granularity();
        Map<String, Object> filters = new TreeMap<>();

        ReportTimeseriesResponse response = switch (section) {
            case USERS -> aggregationService.getUsersTimeseries(range, granularity);
            case LISTINGS -> {
                putFilter(filters, "categoryId", request.categoryId());
                putFilter(filters, "listingType", request.listingType());
                yield aggregationService.getListingsTimeseries(
                        range, granularity, request.listingType(), request.categoryId()
                );
            }
            case TRANSACTIONS -> aggregationService.getTransactionsTimeseries(range, granularity);
            case MODERATION -> {
                ReportCategory category = parseEnum(
                        ReportCategory.class, request.category(), "category", section
                );
                putFilter(filters, "category", category);
                putFilter(filters, "targetType", request.targetType());
                yield aggregationService.getModerationTimeseries(
                        range, granularity, category, request.targetType()
                );
            }
            case REVIEWS -> aggregationService.getReviewsTimeseries(range, granularity);
            case SUPPORT -> {
                SupportRequestStatus status = parseEnum(
                        SupportRequestStatus.class, request.status(), "status", section
                );
                SupportCategory category = parseEnum(
                        SupportCategory.class, request.category(), "category", section
                );
                putFilter(filters, "category", category);
                putFilter(filters, "status", status);
                yield aggregationService.getSupportTimeseries(
                        range, granularity, status, category
                );
            }
            case OVERVIEW -> throw new IllegalStateException(
                    "Time series exports are not supported for the overview section"
            );
        };

        return mapper.timeseries(section, response, filtersJson(filters), generatedAt);
    }

    private CsvTable buildTopRequestedTable(
            AdminReportCsvExportRequest request,
            ReportDateRange range,
            String generatedAt
    ) {
        TopRequestedListingsResponse response = aggregationService.getTopRequestedListings(
                range, request.limit(), request.categoryId()
        );

        Map<String, Object> filters = new TreeMap<>();
        putFilter(filters, "categoryId", request.categoryId());
        putFilter(filters, "limit", response.limit());
        filters.put("countedRequestStatuses", response.countedRequestStatuses());

        return mapper.topRequested(response, filtersJson(filters), generatedAt);
    }

    private void putFilter(Map<String, Object> filters, String key, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof Enum<?> enumValue) {
            filters.put(key, enumValue.name());
        } else if (value instanceof UUID uuid) {
            filters.put(key, uuid.toString());
        } else {
            filters.put(key, value);
        }
    }

    private String filtersJson(Map<String, Object> filters) {
        try {
            return objectMapper.writeValueAsString(filters);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize report filters", ex);
        }
    }

    private <E extends Enum<E>> E parseEnum(
            Class<E> type,
            String rawValue,
            String parameter,
            AdminReportExportSection section
    ) {
        if (rawValue == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, rawValue.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Unsupported value for '" + parameter + "' in section '"
                            + section.pathValue() + "'"
            );
        }
    }
}
