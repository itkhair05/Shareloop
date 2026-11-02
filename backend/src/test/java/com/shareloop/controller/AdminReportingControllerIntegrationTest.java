package com.shareloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminReportingControllerIntegrationTest {

    private static final String BASE = "/api/v1/admin/reporting";
    private static final String RANGE = "?from=2000-01-03&to=2000-01-10";

    private static final Instant VN_RANGE_START = Instant.parse("2000-01-02T17:00:00Z");
    private static final Instant VN_RANGE_END = Instant.parse("2000-01-09T17:00:00Z");

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
    private JwtService jwtService;

    private User admin;
    private User regularUser;
    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        admin = createUser("Reporting Admin", UserRole.ADMIN, UserStatus.ACTIVE, Instant.now());
        regularUser = createUser("Reporting User", UserRole.USER, UserStatus.ACTIVE, Instant.now());
        adminToken = "Bearer " + jwtService.generateToken(
                admin.getId(), admin.getEmail(), admin.getRole(), admin.getStatus());
        userToken = "Bearer " + jwtService.generateToken(
                regularUser.getId(), regularUser.getEmail(), regularUser.getRole(), regularUser.getStatus());
    }

    // ==========================================
    // 1. Users summary
    // ==========================================

    @Test
    @DisplayName("Users summary applies [from, to) in the default timezone and reports current status")
    void usersSummary_appliesHalfOpenPeriodAndCurrentStatus() throws Exception {
        createUser("Before Range", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-02T16:59:59Z"));
        createUser("Range Start", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-02T17:00:00Z"));
        createUser("Inside Range", UserRole.ADMIN, UserStatus.SUSPENDED, Instant.parse("2000-01-05T03:00:00Z"));
        createUser("Range End", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-09T17:00:00Z"));

        JsonNode json = getJson(BASE + "/users/summary" + RANGE, adminToken);

        assertThat(json.at("/period/from").asText()).isEqualTo("2000-01-03");
        assertThat(json.at("/period/to").asText()).isEqualTo("2000-01-10");
        assertThat(json.at("/period/timezone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(json.at("/period/fromInclusive").asText()).isEqualTo("2000-01-02T17:00:00Z");
        assertThat(json.at("/period/toExclusive").asText()).isEqualTo("2000-01-09T17:00:00Z");
        assertThat(json.at("/metrics/totalUsers").asLong()).isEqualTo(2);
        assertThat(keys(json.at("/metrics/byRole"))).containsExactly("USER", "ADMIN");
        assertThat(values(json.at("/metrics/byRole"))).containsExactly(1L, 1L);
        assertThat(keys(json.at("/metrics/byStatus")))
                .containsExactly("ACTIVE", "SUSPENDED", "DEACTIVATED");
        assertThat(values(json.at("/metrics/byStatus"))).containsExactly(1L, 1L, 0L);
        assertThat(json.at("/statusSemantics").asText())
                .contains("not status at registration time");

        Long databaseCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?",
                Long.class,
                offset(VN_RANGE_START),
                offset(VN_RANGE_END)
        );
        assertThat(databaseCount).isEqualTo(2L);
    }

    @Test
    @DisplayName("Users summary filters by role and current status")
    void usersSummary_filtersByRoleAndStatus() throws Exception {
        createUser("Active One", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-04T03:00:00Z"));
        createUser("Active Two", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-05T03:00:00Z"));
        createUser("Suspended", UserRole.USER, UserStatus.SUSPENDED, Instant.parse("2000-01-06T03:00:00Z"));
        createUser("Admin Active", UserRole.ADMIN, UserStatus.ACTIVE, Instant.parse("2000-01-07T03:00:00Z"));

        JsonNode filtered = getJson(BASE + "/users/summary" + RANGE + "&role=USER&status=ACTIVE", adminToken);

        assertThat(filtered.at("/metrics/totalUsers").asLong()).isEqualTo(2);
        assertThat(values(filtered.at("/metrics/byRole"))).containsExactly(2L, 0L);
        assertThat(values(filtered.at("/metrics/byStatus"))).containsExactly(2L, 0L, 0L);

        JsonNode adminOnly = getJson(BASE + "/users/summary" + RANGE + "&role=ADMIN", adminToken);
        assertThat(adminOnly.at("/metrics/totalUsers").asLong()).isEqualTo(1);
        assertThat(values(adminOnly.at("/metrics/byRole"))).containsExactly(0L, 1L);
    }

    // ==========================================
    // 2. Users time series
    // ==========================================

    @Test
    @DisplayName("Users time series zero-fills day buckets and excludes the exclusive end boundary")
    void usersTimeseries_zeroFillsDailyBuckets() throws Exception {
        createUser("Day Four A", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-04T03:00:00Z"));
        createUser("Day Four B", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-04T04:00:00Z"));
        createUser("Day Six", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-06T03:00:00Z"));
        createUser("End Boundary", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-07T17:00:00Z"));

        JsonNode json = getJson(
                BASE + "/users/timeseries?from=2000-01-03&to=2000-01-08&granularity=DAY",
                adminToken
        );

        assertThat(json.at("/metric").asText()).isEqualTo("USER_REGISTRATIONS");
        assertThat(json.at("/granularity").asText()).isEqualTo("DAY");
        assertThat(bucketStarts(json.at("/points"))).containsExactly(
                "2000-01-03", "2000-01-04", "2000-01-05", "2000-01-06", "2000-01-07"
        );
        assertThat(bucketValues(json.at("/points"))).containsExactly(0L, 2L, 0L, 1L, 0L);
    }

    @Test
    @DisplayName("Users time series uses ISO Monday weeks and calendar months")
    void usersTimeseries_supportsWeekAndMonthGranularity() throws Exception {
        createUser("Week One", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-05T03:00:00Z"));
        createUser("Week Two", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-10T03:00:00Z"));
        createUser("Week Three", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-17T03:00:00Z"));
        createUser("Month March", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-03-01T03:00:00Z"));

        JsonNode weekly = getJson(
                BASE + "/users/timeseries?from=2000-01-05&to=2000-01-20&granularity=WEEK&timezone=UTC",
                adminToken
        );

        assertThat(bucketStarts(weekly.at("/points")))
                .containsExactly("2000-01-03", "2000-01-10", "2000-01-17");
        assertThat(bucketValues(weekly.at("/points"))).containsExactly(1L, 1L, 1L);

        JsonNode monthly = getJson(
                BASE + "/users/timeseries?from=2000-01-15&to=2000-03-10&granularity=MONTH&timezone=UTC",
                adminToken
        );

        assertThat(bucketStarts(monthly.at("/points")))
                .containsExactly("2000-01-01", "2000-02-01", "2000-03-01");
        assertThat(bucketValues(monthly.at("/points"))).containsExactly(1L, 0L, 1L);
    }

    // ==========================================
    // 3. Listings summary
    // ==========================================

    @Test
    @DisplayName("Listings summary reports actual status, type and category values without synthetic buckets")
    void listingsSummary_reportsActualValues() throws Exception {
        Category alpha = createCategory("Reporting Alpha", "reporting-alpha-" + UUID.randomUUID());
        Category beta = createCategory("Reporting Beta", "reporting-beta-" + UUID.randomUUID());
        User owner = createUser("Listing Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.DRAFT, "Draft Giveaway",
                Instant.parse("2000-01-03T03:00:00Z"));
        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Active Giveaway",
                Instant.parse("2000-01-04T03:00:00Z"));
        createListing(owner, beta, ListingType.WANTED, ListingStatus.RESERVED, "Reserved Wanted",
                Instant.parse("2000-01-05T03:00:00Z"));
        createListing(owner, alpha, ListingType.SALE, ListingStatus.COMPLETED, "Completed Sale",
                Instant.parse("2000-01-06T03:00:00Z"));
        createListing(owner, beta, ListingType.SALE, ListingStatus.CANCELLED, "Cancelled Sale",
                Instant.parse("2000-01-07T03:00:00Z"));
        createListing(owner, beta, ListingType.GIVEAWAY, ListingStatus.REMOVED, "Removed Giveaway",
                Instant.parse("2000-01-08T03:00:00Z"));
        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Before Range",
                Instant.parse("2000-01-02T16:59:59Z"));
        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "End Boundary",
                Instant.parse("2000-01-09T17:00:00Z"));

        JsonNode json = getJson(BASE + "/listings/summary" + RANGE, adminToken);

        assertThat(json.at("/metrics/totalListings").asLong()).isEqualTo(6);
        assertThat(keys(json.at("/metrics/byStatus")))
                .containsExactly("DRAFT", "ACTIVE", "RESERVED", "COMPLETED", "CANCELLED", "REMOVED");
        assertThat(values(json.at("/metrics/byStatus"))).containsExactly(1L, 1L, 1L, 1L, 1L, 1L);
        assertThat(keys(json.at("/metrics/byType"))).containsExactly("GIVEAWAY", "SALE", "WANTED");
        assertThat(values(json.at("/metrics/byType"))).containsExactly(3L, 2L, 1L);
        assertThat(categoryNames(json.at("/metrics/byCategory")))
                .containsExactly("Reporting Alpha", "Reporting Beta");
        assertThat(categoryValues(json.at("/metrics/byCategory"))).containsExactly(3L, 3L);
        assertThat(json.at("/statusSemantics").asText())
                .contains("status history is not recorded");

        Long activeInRange = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM listings WHERE created_at >= ? AND created_at < ? AND status = 'ACTIVE'",
                Long.class,
                offset(VN_RANGE_START),
                offset(VN_RANGE_END)
        );
        assertThat(activeInRange).isEqualTo(1L);
    }

    @Test
    @DisplayName("Listings summary applies status, type and category filters")
    void listingsSummary_appliesFilters() throws Exception {
        Category alpha = createCategory("Filter Alpha", "filter-alpha-" + UUID.randomUUID());
        Category beta = createCategory("Filter Beta", "filter-beta-" + UUID.randomUUID());
        User owner = createUser("Filter Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Alpha Active",
                Instant.parse("2000-01-04T03:00:00Z"));
        createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE, "Alpha Sale",
                Instant.parse("2000-01-05T03:00:00Z"));
        createListing(owner, beta, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Beta Active",
                Instant.parse("2000-01-06T03:00:00Z"));

        JsonNode json = getJson(
                BASE + "/listings/summary" + RANGE + "&status=ACTIVE&listingType=GIVEAWAY&categoryId=" + alpha.getId(),
                adminToken
        );

        assertThat(json.at("/metrics/totalListings").asLong()).isEqualTo(1);
        assertThat(values(json.at("/metrics/byStatus"))).containsExactly(0L, 1L, 0L, 0L, 0L, 0L);
        assertThat(values(json.at("/metrics/byType"))).containsExactly(1L, 0L, 0L);
        assertThat(categoryNames(json.at("/metrics/byCategory"))).containsExactly("Filter Alpha");
        assertThat(categoryValues(json.at("/metrics/byCategory"))).containsExactly(1L);
    }

    // ==========================================
    // 4. Listings time series
    // ==========================================

    @Test
    @DisplayName("Listings time series zero-fills buckets and applies type and category filters")
    void listingsTimeseries_zeroFillsAndFilters() throws Exception {
        Category alpha = createCategory("Series Alpha", "series-alpha-" + UUID.randomUUID());
        Category beta = createCategory("Series Beta", "series-beta-" + UUID.randomUUID());
        User owner = createUser("Series Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE, "Alpha Sale",
                Instant.parse("2000-01-04T03:00:00Z"));
        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Alpha Giveaway",
                Instant.parse("2000-01-04T04:00:00Z"));
        createListing(owner, beta, ListingType.SALE, ListingStatus.ACTIVE, "Beta Sale",
                Instant.parse("2000-01-06T03:00:00Z"));
        createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE, "Outside Sale",
                Instant.parse("2000-01-08T03:00:00Z"));

        JsonNode filtered = getJson(
                BASE + "/listings/timeseries?from=2000-01-03&to=2000-01-07&granularity=DAY"
                        + "&listingType=SALE&categoryId=" + alpha.getId(),
                adminToken
        );

        assertThat(filtered.at("/metric").asText()).isEqualTo("LISTING_CREATIONS");
        assertThat(bucketStarts(filtered.at("/points")))
                .containsExactly("2000-01-03", "2000-01-04", "2000-01-05", "2000-01-06");
        assertThat(bucketValues(filtered.at("/points"))).containsExactly(0L, 1L, 0L, 0L);

        JsonNode unfiltered = getJson(
                BASE + "/listings/timeseries?from=2000-01-03&to=2000-01-07&granularity=DAY",
                adminToken
        );
        assertThat(bucketValues(unfiltered.at("/points"))).containsExactly(0L, 2L, 0L, 1L);
    }

    // ==========================================
    // 5. Top requested listings
    // ==========================================

    @Test
    @DisplayName("Top requested counts only PENDING, ACCEPTED and REJECTED with a stable tie-breaker")
    void topRequested_countsOnlySupportedStatusesAndOrdersDeterministically() throws Exception {
        Category alpha = createCategory("Top Alpha", "top-alpha-" + UUID.randomUUID());
        Category beta = createCategory("Top Beta", "top-beta-" + UUID.randomUUID());
        User owner = createUser("Top Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        Listing first = createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE,
                "Top First", Instant.parse("2000-01-01T03:00:00Z"));
        Listing second = createListing(owner, beta, ListingType.GIVEAWAY, ListingStatus.ACTIVE,
                "Top Second", Instant.parse("2000-01-01T04:00:00Z"));
        Listing third = createListing(owner, beta, ListingType.WANTED, ListingStatus.ACTIVE,
                "Top Third", Instant.parse("2000-01-01T05:00:00Z"));
        Listing outside = createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE,
                "Top Outside", Instant.parse("2000-01-01T06:00:00Z"));

        createRequest(first, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T03:00:00Z"));
        createRequest(first, ListingRequestStatus.ACCEPTED, Instant.parse("2000-01-04T04:00:00Z"));
        createRequest(first, ListingRequestStatus.REJECTED, Instant.parse("2000-01-04T05:00:00Z"));
        createRequest(first, ListingRequestStatus.WITHDRAWN, Instant.parse("2000-01-04T06:00:00Z"));

        createRequest(second, ListingRequestStatus.PENDING, Instant.parse("2000-01-05T03:00:00Z"));
        createRequest(second, ListingRequestStatus.ACCEPTED, Instant.parse("2000-01-05T04:00:00Z"));
        createRequest(second, ListingRequestStatus.REJECTED, Instant.parse("2000-01-05T05:00:00Z"));

        createRequest(third, ListingRequestStatus.PENDING, Instant.parse("2000-01-06T03:00:00Z"));
        createRequest(third, ListingRequestStatus.WITHDRAWN, Instant.parse("2000-01-06T04:00:00Z"));
        createRequest(third, ListingRequestStatus.CANCELLED, Instant.parse("2000-01-06T05:00:00Z"));

        createRequest(outside, ListingRequestStatus.PENDING, Instant.parse("2000-01-02T16:59:59Z"));
        createRequest(outside, ListingRequestStatus.ACCEPTED, Instant.parse("2000-01-09T17:00:00Z"));

        JsonNode json = getJson(BASE + "/listings/top-requested" + RANGE, adminToken);

        List<String> countedStatuses = new ArrayList<>();
        json.at("/countedRequestStatuses").forEach(node -> countedStatuses.add(node.asText()));
        assertThat(countedStatuses).containsExactly("PENDING", "ACCEPTED", "REJECTED");
        assertThat(json.at("/limit").asInt()).isEqualTo(10);

        List<UUID> tieOrder = new ArrayList<>(List.of(first.getId(), second.getId()));
        tieOrder.sort(Comparator.comparing(UUID::toString));

        assertThat(listingIds(json.at("/listings"))).containsExactly(
                tieOrder.get(0).toString(),
                tieOrder.get(1).toString(),
                third.getId().toString()
        );
        assertThat(requestCounts(json.at("/listings"))).containsExactly(3L, 3L, 1L);

        Listing earliestTie = tieOrder.get(0).equals(first.getId()) ? first : second;

        JsonNode topItem = json.at("/listings/0");
        assertThat(topItem.at("/ownerId").asText()).isEqualTo(owner.getId().toString());
        assertThat(topItem.at("/ownerDisplayName").asText()).isEqualTo("Top Owner");
        assertThat(topItem.at("/title").asText()).isEqualTo(earliestTie.getTitle());
        assertThat(topItem.at("/listingType").asText()).isEqualTo(earliestTie.getListingType().name());
        assertThat(topItem.at("/categoryId").asText()).isEqualTo(earliestTie.getCategory().getId().toString());

        Long countedInRange = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM listing_requests WHERE created_at >= ? AND created_at < ? "
                        + "AND status IN ('PENDING', 'ACCEPTED', 'REJECTED')",
                Long.class,
                offset(VN_RANGE_START),
                offset(VN_RANGE_END)
        );
        Long allInRange = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM listing_requests WHERE created_at >= ? AND created_at < ?",
                Long.class,
                offset(VN_RANGE_START),
                offset(VN_RANGE_END)
        );
        assertThat(countedInRange).isEqualTo(7L);
        assertThat(allInRange).isEqualTo(10L);
    }

    @Test
    @DisplayName("Top requested supports limit and category filtering")
    void topRequested_supportsLimitAndCategoryFilter() throws Exception {
        Category alpha = createCategory("Limit Alpha", "limit-alpha-" + UUID.randomUUID());
        Category beta = createCategory("Limit Beta", "limit-beta-" + UUID.randomUUID());
        User owner = createUser("Limit Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        Listing first = createListing(owner, alpha, ListingType.SALE, ListingStatus.ACTIVE,
                "Limit First", Instant.parse("2000-01-01T03:00:00Z"));
        Listing second = createListing(owner, beta, ListingType.SALE, ListingStatus.ACTIVE,
                "Limit Second", Instant.parse("2000-01-01T04:00:00Z"));
        Listing third = createListing(owner, beta, ListingType.SALE, ListingStatus.ACTIVE,
                "Limit Third", Instant.parse("2000-01-01T05:00:00Z"));

        createRequest(first, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T03:00:00Z"));
        createRequest(second, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T04:00:00Z"));
        createRequest(second, ListingRequestStatus.ACCEPTED, Instant.parse("2000-01-04T05:00:00Z"));
        createRequest(third, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T06:00:00Z"));

        JsonNode limited = getJson(BASE + "/listings/top-requested" + RANGE + "&limit=2", adminToken);
        assertThat(limited.at("/limit").asInt()).isEqualTo(2);
        assertThat(limited.at("/listings").size()).isEqualTo(2);

        JsonNode betaOnly = getJson(
                BASE + "/listings/top-requested" + RANGE + "&categoryId=" + beta.getId(),
                adminToken
        );
        assertThat(listingIds(betaOnly.at("/listings")))
                .containsExactly(second.getId().toString(), third.getId().toString());
        assertThat(requestCounts(betaOnly.at("/listings"))).containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("Top requested rejects limits outside 1..50")
    void topRequested_validatesLimit() throws Exception {
        mockMvc.perform(get(BASE + "/listings/top-requested" + RANGE + "&limit=0")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/listings/top-requested" + RANGE + "&limit=51")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/listings/top-requested" + RANGE + "&limit=50")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.limit").value(50));
    }

    // ==========================================
    // 6. Overview
    // ==========================================

    @Test
    @DisplayName("Overview aggregates users and listings and declares its Phase 2 scope")
    void overview_aggregatesBothDomainsAndDeclaresScope() throws Exception {
        Category alpha = createCategory("Overview Alpha", "overview-alpha-" + UUID.randomUUID());
        User owner = createUser("Overview Owner", UserRole.USER, UserStatus.ACTIVE,
                Instant.parse("2000-01-04T03:00:00Z"));
        createUser("Overview Admin", UserRole.ADMIN, UserStatus.SUSPENDED,
                Instant.parse("2000-01-05T03:00:00Z"));

        createListing(owner, alpha, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Overview Giveaway",
                Instant.parse("2000-01-04T05:00:00Z"));
        createListing(owner, alpha, ListingType.SALE, ListingStatus.DRAFT, "Overview Sale",
                Instant.parse("2000-01-05T05:00:00Z"));

        JsonNode overview = getJson(BASE + "/overview" + RANGE, adminToken);

        assertThat(texts(overview.at("/includedDomains"))).containsExactly(
                "USERS", "LISTINGS", "TRANSACTIONS", "MODERATION", "REVIEWS", "SUPPORT"
        );
        assertThat(texts(overview.at("/includedMetrics"))).containsExactly(
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
                "REVIEWS_BY_RATING_ALL",
                "REVIEWS_BY_RATING_VISIBLE",
                "REVIEWS_AVERAGE_RATING_VISIBLE",
                "REVIEWS_AVERAGE_RATING_ALL",
                "SUPPORT_REQUESTS_CREATED",
                "SUPPORT_BY_CURRENT_STATUS",
                "SUPPORT_BY_CATEGORY"
        );
        assertThat(overview.at("/users/totalUsers").asLong()).isEqualTo(2);
        assertThat(keys(overview.at("/users/byStatus")))
                .containsExactly("ACTIVE", "SUSPENDED", "DEACTIVATED");
        assertThat(values(overview.at("/users/byStatus"))).containsExactly(1L, 1L, 0L);
        assertThat(overview.at("/listings/totalListings").asLong()).isEqualTo(2);
        assertThat(keys(overview.at("/listings/byStatus")))
                .containsExactly("DRAFT", "ACTIVE", "RESERVED", "COMPLETED", "CANCELLED", "REMOVED");
        assertThat(values(overview.at("/listings/byStatus"))).containsExactly(1L, 1L, 0L, 0L, 0L, 0L);
        assertThat(overview.at("/disclaimer").asText())
                .contains("support requests")
                .contains("Financial");
        assertThat(keys(overview.at("/users/byStatus"))).doesNotContain("OTHER");
        assertThat(keys(overview.at("/listings/byStatus"))).doesNotContain("OTHER");

        JsonNode usersSummary = getJson(BASE + "/users/summary" + RANGE, adminToken);
        JsonNode listingsSummary = getJson(BASE + "/listings/summary" + RANGE, adminToken);
        assertThat(overview.at("/users/totalUsers").asLong())
                .isEqualTo(usersSummary.at("/metrics/totalUsers").asLong());
        assertThat(overview.at("/listings/totalListings").asLong())
                .isEqualTo(listingsSummary.at("/metrics/totalListings").asLong());
    }

    // ==========================================
    // 7. Timezone and validation
    // ==========================================

    @Test
    @DisplayName("Local date boundaries are converted using the requested timezone")
    void timezoneConversion_changesMembershipForTheSameInstants() throws Exception {
        createUser("Vietnam Midnight", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-02T17:30:00Z"));

        JsonNode vietnam = getJson(BASE + "/users/summary?from=2000-01-03&to=2000-01-04", adminToken);
        assertThat(vietnam.at("/period/timezone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(vietnam.at("/metrics/totalUsers").asLong()).isEqualTo(1);

        JsonNode utcPreviousDay = getJson(
                BASE + "/users/summary?from=2000-01-02&to=2000-01-03&timezone=UTC",
                adminToken
        );
        assertThat(utcPreviousDay.at("/metrics/totalUsers").asLong()).isEqualTo(1);

        JsonNode utcSameDay = getJson(
                BASE + "/users/summary?from=2000-01-03&to=2000-01-04&timezone=UTC",
                adminToken
        );
        assertThat(utcSameDay.at("/metrics/totalUsers").asLong()).isZero();
    }

    @Test
    @DisplayName("Time-series bucket labels follow the requested timezone")
    void timeseriesBuckets_useRequestedTimezone() throws Exception {
        createUser("VN Bucket", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-02T17:30:00Z"));

        JsonNode vietnam = getJson(
                BASE + "/users/timeseries?from=2000-01-03&to=2000-01-04&granularity=DAY",
                adminToken
        );
        assertThat(bucketStarts(vietnam.at("/points"))).containsExactly("2000-01-03");
        assertThat(bucketValues(vietnam.at("/points"))).containsExactly(1L);

        JsonNode utc = getJson(
                BASE + "/users/timeseries?from=2000-01-02&to=2000-01-03&granularity=DAY&timezone=UTC",
                adminToken
        );
        assertThat(bucketStarts(utc.at("/points"))).containsExactly("2000-01-02");
        assertThat(bucketValues(utc.at("/points"))).containsExactly(1L);
    }

    @Test
    @DisplayName("Invalid range, timezone, granularity and dates return 400")
    void invalidParameters_return400() throws Exception {
        mockMvc.perform(get(BASE + "/users/summary?from=2000-01-10&to=2000-01-03")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/users/summary" + RANGE + "&timezone=Mars/Phobos")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/users/timeseries" + RANGE + "&granularity=YEAR")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/users/summary?from=not-a-date&to=2000-01-03")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/listings/summary" + RANGE + "&status=ARCHIVED")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "/listings/summary" + RANGE + "&categoryId=not-a-uuid")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Empty periods return zero totals and zero-filled series")
    void emptyPeriods_returnZeroFilledResponses() throws Exception {
        JsonNode summary = getJson(
                BASE + "/users/summary?from=2000-02-01&to=2000-02-03",
                adminToken
        );
        assertThat(summary.at("/metrics/totalUsers").asLong()).isZero();
        assertThat(values(summary.at("/metrics/byRole"))).containsExactly(0L, 0L);
        assertThat(values(summary.at("/metrics/byStatus"))).containsExactly(0L, 0L, 0L);

        JsonNode timeseries = getJson(
                BASE + "/listings/timeseries?from=2000-02-01&to=2000-02-03&granularity=DAY",
                adminToken
        );
        assertThat(bucketStarts(timeseries.at("/points"))).containsExactly("2000-02-01", "2000-02-02");
        assertThat(bucketValues(timeseries.at("/points"))).containsExactly(0L, 0L);
    }

    @Test
    @DisplayName("Default period ends today in Asia/Ho_Chi_Minh and spans 30 days")
    void defaultPeriod_usesTodayAndThirtyDays() throws Exception {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate before = LocalDate.now(zone);

        JsonNode json = getJson(BASE + "/users/summary", adminToken);

        LocalDate after = LocalDate.now(zone);
        assertThat(json.at("/period/timezone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(LocalDate.parse(json.at("/period/to").asText())).isIn(before, after);
        LocalDate to = LocalDate.parse(json.at("/period/to").asText());
        assertThat(LocalDate.parse(json.at("/period/from").asText())).isEqualTo(to.minusDays(30));
    }

    // ==========================================
    // 8. Security
    // ==========================================

    @Test
    @DisplayName("All reporting endpoints require an authenticated ADMIN")
    void reportingEndpoints_requireAdminRole() throws Exception {
        List<String> paths = List.of(
                "/users/summary",
                "/users/timeseries",
                "/listings/summary",
                "/listings/timeseries",
                "/listings/top-requested",
                "/overview"
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
    @DisplayName("Responses never expose authentication secrets")
    void responses_doNotExposeSensitiveFields() throws Exception {
        createUser("Privacy User", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-05T03:00:00Z"));

        String body = performJson(BASE + "/users/summary" + RANGE, adminToken);

        assertThat(body).doesNotContain("passwordHash");
        assertThat(body).doesNotContain("password_hash");
        assertThat(body).doesNotContain("resetToken");
        assertThat(body).doesNotContain("providerSubject");
    }

    // ==========================================
    // Helpers
    // ==========================================

    private User createUser(String displayName, UserRole role, UserStatus status, Instant createdAt) {
        User user = new User(
                displayName,
                "reporting." + UUID.randomUUID() + "@shareloop.vn",
                "test-password-hash",
                role,
                status
        );
        user.setCreatedAt(createdAt);
        return userRepository.saveAndFlush(user);
    }

    private Category createCategory(String name, String slug) {
        return categoryRepository.saveAndFlush(new Category(name, slug, "Reporting test category", true));
    }

    private Listing createListing(
            User owner,
            Category category,
            ListingType type,
            ListingStatus status,
            String title,
            Instant createdAt
    ) {
        Listing listing = new Listing(owner, category, type, title, "Reporting test listing", "Ha Noi");
        listing.setStatus(status);
        if (type == ListingType.SALE) {
            listing.setPrice(new BigDecimal("150000.00"));
            listing.setCurrency("VND");
        } else if (type == ListingType.WANTED) {
            listing.setPrice(new BigDecimal("50000.00"));
            listing.setCurrency("VND");
        }
        listing.setCreatedAt(createdAt);
        return listingRepository.saveAndFlush(listing);
    }

    private ListingRequest createRequest(Listing listing, ListingRequestStatus status, Instant createdAt) {
        User requester = createUser(
                "Requester " + UUID.randomUUID(),
                UserRole.USER,
                UserStatus.ACTIVE,
                Instant.now()
        );
        ListingRequest request = new ListingRequest(listing, requester, "Reporting test request", status);
        request.setCreatedAt(createdAt);
        return listingRequestRepository.saveAndFlush(request);
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

    private static List<String> categoryNames(JsonNode array) {
        List<String> names = new ArrayList<>();
        array.forEach(node -> names.add(node.get("categoryName").asText()));
        return names;
    }

    private static List<Long> categoryValues(JsonNode array) {
        List<Long> values = new ArrayList<>();
        array.forEach(node -> values.add(node.get("value").asLong()));
        return values;
    }

    private static List<String> listingIds(JsonNode array) {
        List<String> ids = new ArrayList<>();
        array.forEach(node -> ids.add(node.get("listingId").asText()));
        return ids;
    }

    private static List<Long> requestCounts(JsonNode array) {
        List<Long> counts = new ArrayList<>();
        array.forEach(node -> counts.add(node.get("requestCount").asLong()));
        return counts;
    }
}
