package com.shareloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Report;
import com.shareloop.entity.Review;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.ReportRepository;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminPhase3ReportingControllerIntegrationTest {

    private static final String BASE = "/api/v1/admin/reporting";
    private static final String RANGE = "?from=2003-05-05&to=2003-05-12";
    private static final String EMPTY_RANGE = "?from=1975-01-01&to=1975-01-02";

    private static final Instant RANGE_START = Instant.parse("2003-05-04T17:00:00Z");
    private static final Instant RANGE_END = Instant.parse("2003-05-11T17:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private JwtService jwtService;

    private User admin;
    private User owner;
    private User requester;
    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        admin = createUser("Phase 3 Admin", UserRole.ADMIN);
        owner = createUser("Phase 3 Owner", UserRole.USER);
        requester = createUser("Phase 3 Requester", UserRole.USER);
        adminToken = "Bearer " + jwtService.generateToken(
                admin.getId(), admin.getEmail(), admin.getRole(), admin.getStatus());
        userToken = "Bearer " + jwtService.generateToken(
                owner.getId(), owner.getEmail(), owner.getRole(), owner.getStatus());
    }

    // ==========================================
    // Transactions
    // ==========================================

    @Test
    @DisplayName("Transactions summary applies [from, to) and reports current status")
    void transactionsSummary_appliesHalfOpenPeriodAndCurrentStatus() throws Exception {
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-04T16:59:59Z"));
        createTransaction(TransactionStatus.PENDING, RANGE_START);
        createTransaction(TransactionStatus.IN_PROGRESS, Instant.parse("2003-05-07T03:00:00Z"));
        createTransaction(TransactionStatus.COMPLETED, Instant.parse("2003-05-11T16:59:59Z"));
        createTransaction(TransactionStatus.CANCELLED, RANGE_END);

        JsonNode json = getJson(BASE + "/transactions/summary" + RANGE, adminToken);

        assertThat(json.at("/period/from").asText()).isEqualTo("2003-05-05");
        assertThat(json.at("/period/to").asText()).isEqualTo("2003-05-12");
        assertThat(json.at("/period/timezone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(json.at("/period/fromInclusive").asText()).isEqualTo("2003-05-04T17:00:00Z");
        assertThat(json.at("/period/toExclusive").asText()).isEqualTo("2003-05-11T17:00:00Z");
        assertThat(json.at("/metrics/totalTransactions").asLong()).isEqualTo(3);
        assertThat(keys(json.at("/metrics/byStatus")))
                .containsExactly("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED");
        assertThat(values(json.at("/metrics/byStatus"))).containsExactly(1L, 1L, 1L, 0L);
        assertThat(json.at("/statusSemantics").asText()).contains("Current status");
    }

    @Test
    @DisplayName("Transactions summary filters by current status and matches direct SQL")
    void transactionsSummary_statusFilterAndSqlAgreement() throws Exception {
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-06T03:00:00Z"));
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-06T04:00:00Z"));
        createTransaction(TransactionStatus.COMPLETED, Instant.parse("2003-05-06T05:00:00Z"));

        JsonNode filtered = getJson(BASE + "/transactions/summary" + RANGE + "&status=PENDING", adminToken);

        assertThat(filtered.at("/metrics/totalTransactions").asLong()).isEqualTo(2);
        assertThat(values(filtered.at("/metrics/byStatus"))).containsExactly(2L, 0L, 0L, 0L);

        JsonNode all = getJson(BASE + "/transactions/summary" + RANGE, adminToken);
        Long sqlTotal = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM transactions WHERE created_at >= ? AND created_at < ?",
                Long.class,
                offset(RANGE_START),
                offset(RANGE_END)
        );
        assertThat(all.at("/metrics/totalTransactions").asLong()).isEqualTo(sqlTotal);
    }

    @Test
    @DisplayName("Transaction time series supports DAY, WEEK and MONTH zero-filled buckets")
    void transactionsTimeseries_supportsAllGranularities() throws Exception {
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-05T03:00:00Z"));
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-07T03:00:00Z"));
        createTransaction(TransactionStatus.PENDING, Instant.parse("2003-05-07T04:00:00Z"));

        JsonNode day = getJson(
                BASE + "/transactions/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY",
                adminToken
        );
        assertThat(day.at("/metric").asText()).isEqualTo("TRANSACTION_CREATIONS");
        assertThat(bucketStarts(day.at("/points")))
                .containsExactly("2003-05-05", "2003-05-06", "2003-05-07", "2003-05-08");
        assertThat(bucketValues(day.at("/points"))).containsExactly(1L, 0L, 2L, 0L);

        JsonNode week = getJson(
                BASE + "/transactions/timeseries?from=2003-05-07&to=2003-05-14&granularity=WEEK",
                adminToken
        );
        assertThat(bucketStarts(week.at("/points"))).containsExactly("2003-05-05", "2003-05-12");
        assertThat(bucketValues(week.at("/points"))).containsExactly(2L, 0L);

        JsonNode month = getJson(
                BASE + "/transactions/timeseries?from=2003-05-07&to=2003-06-02&granularity=MONTH",
                adminToken
        );
        assertThat(bucketStarts(month.at("/points"))).containsExactly("2003-05-01", "2003-06-01");
        assertThat(bucketValues(month.at("/points"))).containsExactly(2L, 0L);
    }

    // ==========================================
    // Moderation
    // ==========================================

    @Test
    @DisplayName("Moderation summary distributes status, category and target type with zero-filled enums")
    void moderationSummary_distributesAllDimensions() throws Exception {
        createReport(ReportStatus.PENDING, ReportCategory.FRAUD_OR_SCAM, ReportTargetType.USER, inside(1));
        createReport(ReportStatus.INVESTIGATING, ReportCategory.HARASSMENT, ReportTargetType.LISTING, inside(2));
        createReport(ReportStatus.RESOLVED, ReportCategory.ITEM_MISREPRESENTED, ReportTargetType.TRANSACTION, inside(3));
        createReport(ReportStatus.DISMISSED, ReportCategory.NO_SHOW_OR_UNRESPONSIVE, ReportTargetType.REVIEW, inside(4));
        createReport(ReportStatus.PENDING, ReportCategory.PROHIBITED_ITEM, ReportTargetType.USER, inside(5));
        createReport(ReportStatus.PENDING, ReportCategory.OTHER, ReportTargetType.LISTING, inside(6));

        JsonNode json = getJson(BASE + "/moderation/summary" + RANGE, adminToken);

        assertThat(json.at("/metrics/totalReports").asLong()).isEqualTo(6);
        assertThat(keys(json.at("/metrics/byStatus")))
                .containsExactly("PENDING", "INVESTIGATING", "RESOLVED", "DISMISSED");
        assertThat(values(json.at("/metrics/byStatus"))).containsExactly(3L, 1L, 1L, 1L);
        assertThat(keys(json.at("/metrics/byCategory"))).containsExactly(
                "FRAUD_OR_SCAM",
                "HARASSMENT",
                "ITEM_MISREPRESENTED",
                "NO_SHOW_OR_UNRESPONSIVE",
                "PROHIBITED_ITEM",
                "OTHER"
        );
        assertThat(values(json.at("/metrics/byCategory"))).containsExactly(1L, 1L, 1L, 1L, 1L, 1L);
        assertThat(keys(json.at("/metrics/byTargetType")))
                .containsExactly("USER", "LISTING", "TRANSACTION", "REVIEW");
        assertThat(values(json.at("/metrics/byTargetType"))).containsExactly(2L, 2L, 1L, 1L);
    }

    @Test
    @DisplayName("Moderation filters work and reopened reports reflect only their current state")
    void moderationSummary_filtersAndReopenUsesCurrentState() throws Exception {
        Report resolved = createReport(
                ReportStatus.RESOLVED, ReportCategory.FRAUD_OR_SCAM, ReportTargetType.USER, inside(1));
        createReport(ReportStatus.PENDING, ReportCategory.FRAUD_OR_SCAM, ReportTargetType.USER, inside(2));
        createReport(ReportStatus.PENDING, ReportCategory.HARASSMENT, ReportTargetType.LISTING, inside(3));

        JsonNode userFiltered = getJson(
                BASE + "/moderation/summary" + RANGE + "&targetType=USER",
                adminToken
        );
        assertThat(userFiltered.at("/metrics/totalReports").asLong()).isEqualTo(2);
        assertThat(values(userFiltered.at("/metrics/byTargetType"))).containsExactly(2L, 0L, 0L, 0L);

        resolved.setStatus(ReportStatus.PENDING);
        resolved.setResolvedAt(null);
        resolved.setResolvedBy(null);
        reportRepository.saveAndFlush(resolved);

        JsonNode reopened = getJson(BASE + "/moderation/summary" + RANGE, adminToken);
        assertThat(values(reopened.at("/metrics/byStatus"))).containsExactly(3L, 0L, 0L, 0L);

        String body = performJson(BASE + "/moderation/summary" + RANGE, adminToken);
        assertThat(body).doesNotContain("averageResolutionTime");
        assertThat(body).doesNotContain("sla");
        assertThat(body).doesNotContain("reopen");
    }

    @Test
    @DisplayName("Moderation time series zero-fills DAY buckets and applies category/target filters")
    void moderationTimeseries_zeroFillsBuckets() throws Exception {
        createReport(ReportStatus.PENDING, ReportCategory.OTHER, ReportTargetType.LISTING, inside(1));
        createReport(ReportStatus.PENDING, ReportCategory.OTHER, ReportTargetType.LISTING, inside(49));
        createReport(ReportStatus.PENDING, ReportCategory.HARASSMENT, ReportTargetType.USER, inside(1));

        JsonNode json = getJson(
                BASE + "/moderation/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY",
                adminToken
        );

        assertThat(json.at("/metric").asText()).isEqualTo("MODERATION_REPORT_CREATIONS");
        assertThat(bucketStarts(json.at("/points")))
                .containsExactly("2003-05-05", "2003-05-06", "2003-05-07", "2003-05-08");
        assertThat(bucketValues(json.at("/points"))).containsExactly(2L, 0L, 1L, 0L);

        JsonNode filtered = getJson(
                BASE + "/moderation/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY"
                        + "&category=HARASSMENT&targetType=USER",
                adminToken
        );
        assertThat(bucketValues(filtered.at("/points"))).containsExactly(1L, 0L, 0L, 0L);
    }

    // ==========================================
    // Reviews
    // ==========================================

    @Test
    @DisplayName("Reviews summary implements Policy C for visible and hidden populations")
    void reviewsSummary_implementsPolicyC() throws Exception {
        createReview(5, false, inside(1));
        createReview(3, false, inside(2));
        createReview(1, true, inside(3));

        JsonNode json = getJson(BASE + "/reviews/summary" + RANGE, adminToken);

        assertThat(json.at("/metrics/totalReviews").asLong()).isEqualTo(3);
        assertThat(json.at("/metrics/visibleReviews").asLong()).isEqualTo(2);
        assertThat(json.at("/metrics/hiddenReviews").asLong()).isEqualTo(1);
        assertThat(json.at("/metrics/averageRatingVisible").asDouble()).isEqualTo(4.0);
        assertThat(json.at("/metrics/averageRatingAll").asDouble()).isEqualTo(3.0);
        assertThat(keys(json.at("/metrics/ratingDistributionAll")))
                .containsExactly("1", "2", "3", "4", "5");
        assertThat(values(json.at("/metrics/ratingDistributionAll"))).containsExactly(1L, 0L, 1L, 0L, 1L);
        assertThat(values(json.at("/metrics/ratingDistributionVisible"))).containsExactly(0L, 0L, 1L, 0L, 1L);
        assertThat(json.at("/visibilitySemantics").asText()).contains("public-facing");

        String body = performJson(BASE + "/reviews/summary" + RANGE, adminToken);
        assertThat(body).doesNotContain("SECRET-REVIEW-COMMENT");
        assertThat(body).doesNotContain("reviewer");
        assertThat(body).doesNotContain("reviewee");
    }

    @Test
    @DisplayName("Reviews summary returns null averages when the period has no reviews")
    void reviewsSummary_emptyPeriodReturnsNullAverages() throws Exception {
        JsonNode json = getJson(BASE + "/reviews/summary" + EMPTY_RANGE, adminToken);

        assertThat(json.at("/metrics/totalReviews").asLong()).isZero();
        assertThat(json.at("/metrics/visibleReviews").asLong()).isZero();
        assertThat(json.at("/metrics/hiddenReviews").asLong()).isZero();
        assertThat(json.at("/metrics/averageRatingVisible").isNull()).isTrue();
        assertThat(json.at("/metrics/averageRatingAll").isNull()).isTrue();
        assertThat(values(json.at("/metrics/ratingDistributionAll"))).containsExactly(0L, 0L, 0L, 0L, 0L);
        assertThat(values(json.at("/metrics/ratingDistributionVisible"))).containsExactly(0L, 0L, 0L, 0L, 0L);
    }

    @Test
    @DisplayName("Review time series includes hidden reviews and zero-fills buckets")
    void reviewsTimeseries_zeroFillsBuckets() throws Exception {
        createReview(5, false, inside(1));
        createReview(2, false, inside(49));
        createReview(1, true, inside(49));

        JsonNode json = getJson(
                BASE + "/reviews/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY",
                adminToken
        );

        assertThat(json.at("/metric").asText()).isEqualTo("REVIEW_CREATIONS");
        assertThat(bucketStarts(json.at("/points")))
                .containsExactly("2003-05-05", "2003-05-06", "2003-05-07", "2003-05-08");
        assertThat(bucketValues(json.at("/points"))).containsExactly(1L, 0L, 2L, 0L);
    }

    // ==========================================
    // Support
    // ==========================================

    @Test
    @DisplayName("Support summary counts the creation cohort and includes admin-created requests")
    void supportSummary_distributesPeriodCohort() throws Exception {
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(1));
        createSupport(requester, SupportRequestStatus.IN_PROGRESS, SupportCategory.TRANSACTION_ISSUE, inside(2));
        createSupport(requester, SupportRequestStatus.RESOLVED, SupportCategory.SAFETY_CONCERN, inside(3));
        createSupport(requester, SupportRequestStatus.CLOSED, SupportCategory.OTHER, inside(4));
        createSupport(admin, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(5));

        JsonNode json = getJson(BASE + "/support/summary" + RANGE, adminToken);

        assertThat(json.at("/metrics/totalSupportRequests").asLong()).isEqualTo(5);
        assertThat(keys(json.at("/metrics/byCurrentStatus")))
                .containsExactly("PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED");
        assertThat(values(json.at("/metrics/byCurrentStatus"))).containsExactly(2L, 1L, 1L, 1L);
        assertThat(keys(json.at("/metrics/byCategory"))).containsExactly(
                "TRANSACTION_ISSUE", "ACCOUNT_ISSUE", "SAFETY_CONCERN", "OTHER");
        assertThat(values(json.at("/metrics/byCategory"))).containsExactly(1L, 2L, 1L, 1L);

        Long sqlTotal = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM support_requests WHERE created_at >= ? AND created_at < ?",
                Long.class,
                offset(RANGE_START),
                offset(RANGE_END)
        );
        assertThat(json.at("/metrics/totalSupportRequests").asLong()).isEqualTo(sqlTotal);
    }

    @Test
    @DisplayName("Current open workload is system-wide and unaffected by period or filters")
    void supportCurrentWorkload_isSystemWideAndUnaffectedByFilters() throws Exception {
        long baselinePending = supportRequestRepository.countByStatus(SupportRequestStatus.PENDING);
        long baselineInProgress = supportRequestRepository.countByStatus(SupportRequestStatus.IN_PROGRESS);

        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE,
                Instant.parse("1999-01-01T00:00:00Z"));
        createSupport(requester, SupportRequestStatus.IN_PROGRESS, SupportCategory.ACCOUNT_ISSUE,
                Instant.parse("1999-01-02T00:00:00Z"));
        createSupport(requester, SupportRequestStatus.RESOLVED, SupportCategory.ACCOUNT_ISSUE,
                Instant.parse("1999-01-03T00:00:00Z"));
        createSupport(requester, SupportRequestStatus.CLOSED, SupportCategory.ACCOUNT_ISSUE,
                Instant.parse("1999-01-04T00:00:00Z"));
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(1));

        JsonNode filtered = getJson(
                BASE + "/support/summary?from=2004-01-01&to=2004-01-02"
                        + "&status=RESOLVED&category=SAFETY_CONCERN",
                adminToken
        );

        assertThat(filtered.at("/metrics/totalSupportRequests").asLong()).isZero();
        assertThat(filtered.at("/currentOpenWorkload/scope").asText())
                .isEqualTo("CURRENT_SYSTEM_WIDE_ALL_DATES");
        assertThat(filtered.at("/currentOpenWorkload/asOf").isMissingNode()).isFalse();
        assertThat(filtered.at("/currentOpenWorkload/asOf").asText()).isNotBlank();
        assertThat(filtered.at("/currentOpenWorkload/pending").asLong()).isEqualTo(baselinePending + 2);
        assertThat(filtered.at("/currentOpenWorkload/inProgress").asLong()).isEqualTo(baselineInProgress + 1);
        assertThat(filtered.at("/currentOpenWorkload/totalOpen").asLong())
                .isEqualTo(filtered.at("/currentOpenWorkload/pending").asLong()
                        + filtered.at("/currentOpenWorkload/inProgress").asLong());

        JsonNode unfiltered = getJson(BASE + "/support/summary" + RANGE, adminToken);
        assertThat(unfiltered.at("/currentOpenWorkload/pending").asLong())
                .isEqualTo(filtered.at("/currentOpenWorkload/pending").asLong());
        assertThat(unfiltered.at("/currentOpenWorkload/inProgress").asLong())
                .isEqualTo(filtered.at("/currentOpenWorkload/inProgress").asLong());
    }

    @Test
    @DisplayName("Reopening a support request clears resolved metadata and reporting uses current status")
    void supportReopen_clearsResolvedMetadata() throws Exception {
        SupportRequest request = createSupport(
                requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(1));

        mockMvc.perform(patch("/api/v1/admin/support-requests/{id}", request.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        SupportRequest resolved = supportRequestRepository.findById(request.getId()).orElseThrow();
        assertThat(resolved.getResolvedAt()).isNotNull();
        assertThat(resolved.getResolvedBy()).isNotNull();

        mockMvc.perform(patch("/api/v1/admin/support-requests/{id}", request.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        SupportRequest reopened = supportRequestRepository.findById(request.getId()).orElseThrow();
        assertThat(reopened.getResolvedAt()).isNull();
        assertThat(reopened.getResolvedBy()).isNull();

        JsonNode summary = getJson(BASE + "/support/summary" + RANGE, adminToken);
        assertThat(values(summary.at("/metrics/byCurrentStatus"))).containsExactly(0L, 1L, 0L, 0L);
    }

    @Test
    @DisplayName("A transaction-linked support request is counted once")
    void supportSummary_transactionLinkDoesNotMultiplyCounts() throws Exception {
        Transaction transaction = createTransaction(TransactionStatus.COMPLETED, inside(1));
        SupportRequest request = new SupportRequest(
                requester,
                transaction,
                SupportCategory.TRANSACTION_ISSUE,
                "Linked request",
                "Linked request description"
        );
        request.setCreatedAt(inside(2));
        supportRequestRepository.saveAndFlush(request);

        JsonNode summary = getJson(BASE + "/support/summary" + RANGE, adminToken);
        assertThat(summary.at("/metrics/totalSupportRequests").asLong()).isEqualTo(1);
        assertThat(values(summary.at("/metrics/byCurrentStatus"))).containsExactly(1L, 0L, 0L, 0L);
    }

    @Test
    @DisplayName("Support reporting responses never expose sensitive request fields")
    void supportResponses_doNotExposeSensitiveFields() throws Exception {
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(1));

        assertThat(performJson(BASE + "/support/summary" + RANGE, adminToken))
                .doesNotContain("SECRET-ADMIN-NOTES")
                .doesNotContain("SECRET-ADMIN-RESPONSE")
                .doesNotContain("SECRET-SUPPORT-SUBJECT")
                .doesNotContain("SECRET-SUPPORT-DESCRIPTION")
                .doesNotContain("requesterEmail")
                .doesNotContain("adminNotes")
                .doesNotContain("adminResponse");

        assertThat(performJson(BASE + "/support/timeseries" + RANGE, adminToken))
                .doesNotContain("SECRET-ADMIN-NOTES")
                .doesNotContain("SECRET-SUPPORT-SUBJECT")
                .doesNotContain("adminNotes");
    }

    @Test
    @DisplayName("Support time series zero-fills buckets and applies category filters")
    void supportTimeseries_zeroFillsBucketsAndFilters() throws Exception {
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(1));
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.TRANSACTION_ISSUE, inside(49));
        createSupport(requester, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(73));

        JsonNode day = getJson(
                BASE + "/support/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY",
                adminToken
        );
        assertThat(day.at("/metric").asText()).isEqualTo("SUPPORT_REQUEST_CREATIONS");
        assertThat(bucketValues(day.at("/points"))).containsExactly(1L, 0L, 1L, 1L);
        assertThat(day.has("currentOpenWorkload")).isFalse();

        JsonNode filtered = getJson(
                BASE + "/support/timeseries?from=2003-05-05&to=2003-05-09&granularity=DAY"
                        + "&category=ACCOUNT_ISSUE",
                adminToken
        );
        assertThat(bucketValues(filtered.at("/points"))).containsExactly(1L, 0L, 0L, 1L);
    }

    // ==========================================
    // Shared reporting behavior
    // ==========================================

    @Test
    @DisplayName("Empty periods return zero metrics for all Phase 3 domains")
    void emptyPeriod_returnsZeroFilledMetricsForAllDomains() throws Exception {
        JsonNode transactions = getJson(BASE + "/transactions/summary" + EMPTY_RANGE, adminToken);
        assertThat(transactions.at("/metrics/totalTransactions").asLong()).isZero();
        assertThat(values(transactions.at("/metrics/byStatus"))).containsExactly(0L, 0L, 0L, 0L);

        JsonNode moderation = getJson(BASE + "/moderation/summary" + EMPTY_RANGE, adminToken);
        assertThat(moderation.at("/metrics/totalReports").asLong()).isZero();
        assertThat(values(moderation.at("/metrics/byStatus"))).containsExactly(0L, 0L, 0L, 0L);
        assertThat(values(moderation.at("/metrics/byCategory"))).containsExactly(0L, 0L, 0L, 0L, 0L, 0L);
        assertThat(values(moderation.at("/metrics/byTargetType"))).containsExactly(0L, 0L, 0L, 0L);

        JsonNode reviews = getJson(BASE + "/reviews/summary" + EMPTY_RANGE, adminToken);
        assertThat(reviews.at("/metrics/totalReviews").asLong()).isZero();
        assertThat(reviews.at("/metrics/averageRatingVisible").isNull()).isTrue();

        JsonNode support = getJson(BASE + "/support/summary" + EMPTY_RANGE, adminToken);
        assertThat(support.at("/metrics/totalSupportRequests").asLong()).isZero();
        assertThat(values(support.at("/metrics/byCurrentStatus"))).containsExactly(0L, 0L, 0L, 0L);
        assertThat(values(support.at("/metrics/byCategory"))).containsExactly(0L, 0L, 0L, 0L);

        JsonNode timeseries = getJson(
                BASE + "/transactions/timeseries?from=1975-01-01&to=1975-01-02&granularity=DAY",
                adminToken
        );
        assertThat(bucketValues(timeseries.at("/points"))).containsExactly(0L);
    }

    @Test
    @DisplayName("Timezone conversion uses the default and handles DST zones")
    void timezoneConversion_usesDefaultAndDstZones() throws Exception {
        JsonNode defaultZone = getJson(BASE + "/transactions/summary" + RANGE, adminToken);
        assertThat(defaultZone.at("/period/timezone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(defaultZone.at("/period/fromInclusive").asText()).isEqualTo("2003-05-04T17:00:00Z");
        assertThat(defaultZone.at("/period/toExclusive").asText()).isEqualTo("2003-05-11T17:00:00Z");

        JsonNode newYork = getJson(
                BASE + "/transactions/summary?from=2024-03-10&to=2024-03-11&timezone=America/New_York",
                adminToken
        );
        assertThat(newYork.at("/period/fromInclusive").asText()).isEqualTo("2024-03-10T05:00:00Z");
        assertThat(newYork.at("/period/toExclusive").asText()).isEqualTo("2024-03-11T04:00:00Z");
    }

    @Test
    @DisplayName("Invalid reporting parameters return 400 Bad Request")
    void invalidParameters_returnBadRequest() throws Exception {
        mockMvc.perform(get(BASE + "/transactions/summary?from=2003-05-05&to=2003-05-05")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/transactions/summary?from=2000-01-01&to=2011-01-01")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/transactions/timeseries?from=2000-01-01&to=2002-10-01&granularity=DAY")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/transactions/summary?from=2003-05-05&to=2003-05-06&timezone=Invalid/Zone")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/transactions/summary?from=2003-05-05&to=2003-05-06&status=NOPE")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("All Phase 3 reporting endpoints require an authenticated ADMIN")
    void phase3Endpoints_requireAdminRole() throws Exception {
        List<String> paths = List.of(
                "/transactions/summary",
                "/transactions/timeseries",
                "/moderation/summary",
                "/moderation/timeseries",
                "/reviews/summary",
                "/reviews/timeseries",
                "/support/summary",
                "/support/timeseries"
        );

        for (String path : paths) {
            String url = BASE + path + RANGE;

            mockMvc.perform(get(url))
                    .andExpect(status().isUnauthorized());

            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, userToken))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("Overview contains all six domains and excludes current open workload")
    void overview_containsAllSixDomains() throws Exception {
        createTransaction(TransactionStatus.PENDING, inside(1));
        createReport(ReportStatus.PENDING, ReportCategory.FRAUD_OR_SCAM, ReportTargetType.USER, inside(2));
        createReview(5, false, inside(3));
        createSupport(admin, SupportRequestStatus.PENDING, SupportCategory.ACCOUNT_ISSUE, inside(4));

        JsonNode overview = getJson(BASE + "/overview" + RANGE, adminToken);

        assertThat(texts(overview.at("/includedDomains")))
                .containsExactly("USERS", "LISTINGS", "TRANSACTIONS", "MODERATION", "REVIEWS", "SUPPORT");
        assertThat(texts(overview.at("/includedMetrics")))
                .contains(
                        "TRANSACTIONS_CREATED",
                        "MODERATION_REPORTS_CREATED",
                        "REVIEWS_CREATED",
                        "SUPPORT_REQUESTS_CREATED"
                );
        assertThat(overview.at("/users/totalUsers").isMissingNode()).isFalse();
        assertThat(overview.at("/listings/totalListings").isMissingNode()).isFalse();
        assertThat(overview.at("/transactions/totalTransactions").isMissingNode()).isFalse();
        assertThat(overview.at("/moderation/totalReports").isMissingNode()).isFalse();
        assertThat(overview.at("/reviews/totalReviews").isMissingNode()).isFalse();
        assertThat(overview.at("/support/totalSupportRequests").isMissingNode()).isFalse();
        assertThat(overview.at("/currentOpenWorkload").isMissingNode()).isTrue();
        assertThat(overview.at("/disclaimer").asText()).contains("Financial");

        JsonNode transactionsSummary = getJson(BASE + "/transactions/summary" + RANGE, adminToken);
        JsonNode moderationSummary = getJson(BASE + "/moderation/summary" + RANGE, adminToken);
        JsonNode reviewsSummary = getJson(BASE + "/reviews/summary" + RANGE, adminToken);
        JsonNode supportSummary = getJson(BASE + "/support/summary" + RANGE, adminToken);

        assertThat(overview.at("/transactions/totalTransactions").asLong())
                .isEqualTo(transactionsSummary.at("/metrics/totalTransactions").asLong());
        assertThat(overview.at("/moderation/totalReports").asLong())
                .isEqualTo(moderationSummary.at("/metrics/totalReports").asLong());
        assertThat(overview.at("/reviews/totalReviews").asLong())
                .isEqualTo(reviewsSummary.at("/metrics/totalReviews").asLong());
        assertThat(overview.at("/support/totalSupportRequests").asLong())
                .isEqualTo(supportSummary.at("/metrics/totalSupportRequests").asLong());
    }

    // ==========================================
    // Helpers
    // ==========================================

    private User createUser(String displayName, UserRole role) {
        User user = new User(
                displayName,
                "phase3." + UUID.randomUUID() + "@shareloop.vn",
                "test-password-hash",
                role,
                UserStatus.ACTIVE
        );
        user.setCreatedAt(Instant.now());
        return userRepository.saveAndFlush(user);
    }

    private Transaction createTransaction(TransactionStatus status, Instant createdAt) {
        Category category = categoryRepository.saveAndFlush(new Category(
                "Phase3 " + UUID.randomUUID(),
                "phase3-" + UUID.randomUUID(),
                "Phase 3 reporting category",
                true
        ));
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                category,
                ListingType.GIVEAWAY,
                "Phase 3 listing " + UUID.randomUUID(),
                "Phase 3 reporting listing",
                "Ha Noi"
        ));
        ListingRequest listingRequest = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Phase 3 reporting request",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                listingRequest,
                listing,
                owner,
                requester,
                status
        );
        transaction.setCreatedAt(createdAt);

        if (status == TransactionStatus.COMPLETED) {
            transaction.setOwnerCompleted(true);
            transaction.setRequesterCompleted(true);
            transaction.setOwnerCompletedAt(createdAt.plusSeconds(3600));
            transaction.setRequesterCompletedAt(createdAt.plusSeconds(3600));
        } else if (status == TransactionStatus.CANCELLED) {
            transaction.setCancelledBy(owner);
            transaction.setCancelledAt(createdAt.plusSeconds(3600));
        }

        return transactionRepository.saveAndFlush(transaction);
    }

    private Report createReport(
            ReportStatus status,
            ReportCategory category,
            ReportTargetType targetType,
            Instant createdAt
    ) {
        Report report = new Report(
                requester,
                targetType,
                UUID.randomUUID(),
                category,
                "SECRET-REPORT-DESCRIPTION"
        );
        report.setStatus(status);
        report.setCreatedAt(createdAt);
        return reportRepository.saveAndFlush(report);
    }

    private Review createReview(int rating, boolean hidden, Instant createdAt) {
        Transaction transaction = createTransaction(
                TransactionStatus.COMPLETED,
                createdAt.minusSeconds(3600)
        );
        Review review = new Review(
                transaction,
                requester,
                owner,
                rating,
                "SECRET-REVIEW-COMMENT"
        );
        review.setCreatedAt(createdAt);
        if (hidden) {
            review.setIsHidden(true);
            review.setModeratedBy(admin);
            review.setModeratedAt(createdAt.plusSeconds(60));
        }
        return reviewRepository.saveAndFlush(review);
    }

    private SupportRequest createSupport(
            User requesterUser,
            SupportRequestStatus status,
            SupportCategory category,
            Instant createdAt
    ) {
        SupportRequest supportRequest = new SupportRequest(
                requesterUser,
                null,
                category,
                "SECRET-SUPPORT-SUBJECT-" + UUID.randomUUID(),
                "SECRET-SUPPORT-DESCRIPTION-" + UUID.randomUUID()
        );
        supportRequest.setStatus(status);
        supportRequest.setCreatedAt(createdAt);
        supportRequest.setAdminNotes("SECRET-ADMIN-NOTES");
        supportRequest.setAdminResponse("SECRET-ADMIN-RESPONSE");
        if (status == SupportRequestStatus.RESOLVED || status == SupportRequestStatus.CLOSED) {
            supportRequest.setResolvedBy(admin);
            supportRequest.setResolvedAt(createdAt.plusSeconds(3600));
        }
        return supportRequestRepository.saveAndFlush(supportRequest);
    }

    private static Instant inside(int hoursAfterStart) {
        return RANGE_START.plusSeconds(hoursAfterStart * 3600L);
    }

    private JsonNode getJson(String url, String token) throws Exception {
        MvcResult result = mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String performJson(String url, String token) throws Exception {
        return mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.period").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private static OffsetDateTime offset(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static List<String> keys(JsonNode array) {
        List<String> keys = new ArrayList<>();
        array.forEach(node -> keys.add(node.get("key").asText()));
        return keys;
    }

    private static List<Long> values(JsonNode array) {
        List<Long> values = new ArrayList<>();
        array.forEach(node -> values.add(node.get("value").asLong()));
        return values;
    }

    private static List<String> texts(JsonNode array) {
        List<String> texts = new ArrayList<>();
        array.forEach(node -> texts.add(node.asText()));
        return texts;
    }

    private static List<String> bucketStarts(JsonNode array) {
        List<String> starts = new ArrayList<>();
        array.forEach(node -> starts.add(node.get("bucketStart").asText()));
        return starts;
    }

    private static List<Long> bucketValues(JsonNode array) {
        List<Long> values = new ArrayList<>();
        array.forEach(node -> values.add(node.get("value").asLong()));
        return values;
    }
}
