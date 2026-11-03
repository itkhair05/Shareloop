package com.shareloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminReportingCsvExportControllerIntegrationTest {

    private static final String BASE = "/api/v1/admin/reporting";
    private static final String EXPORT = BASE + "/export";
    private static final String RANGE = "?from=2000-01-03&to=2000-01-10";

    private static final List<String> DOMAIN_SECTIONS = List.of(
            "users", "listings", "transactions", "moderation", "reviews", "support"
    );
    private static final List<String> SUMMARY_SECTIONS = List.of(
            "overview", "users", "listings", "transactions", "moderation", "reviews", "support"
    );

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    private User admin;
    private User regularUser;
    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        admin = createUser("CSV Export Admin", UserRole.ADMIN, UserStatus.ACTIVE, Instant.now());
        regularUser = createUser("CSV Export User", UserRole.USER, UserStatus.ACTIVE, Instant.now());
        adminToken = "Bearer " + jwtService.generateToken(
                admin.getId(), admin.getEmail(), admin.getRole(), admin.getStatus());
        userToken = "Bearer " + jwtService.generateToken(
                regularUser.getId(), regularUser.getEmail(), regularUser.getRole(), regularUser.getStatus());
    }

    @Test
    @DisplayName("Every supported section and dataset produces a CSV attachment with the required headers")
    void exportsEverySupportedSectionAndDataset() throws Exception {
        for (String section : SUMMARY_SECTIONS) {
            CsvDownload download = getCsv(EXPORT + "/" + section + RANGE);
            assertCsvEnvelope(download, section);
        }

        for (String section : DOMAIN_SECTIONS) {
            CsvDownload download = getCsv(EXPORT + "/" + section + RANGE + "&dataset=timeseries");
            assertCsvEnvelope(download, section);
            assertThat(download.response().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                    .isEqualTo("attachment; filename=\"shareloop-report-" + section
                            + "-2000-01-03-2000-01-10.csv\"");
        }

        CsvDownload topRequested = getCsv(
                EXPORT + "/listings" + RANGE + "&dataset=top-requested"
        );
        assertCsvEnvelope(topRequested, "listings");
        assertThat(topRequested.response().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"shareloop-report-listings-2000-01-03-2000-01-10.csv\"");
    }

    @Test
    @DisplayName("The export endpoint requires an authenticated ADMIN")
    void exportRequiresAdmin() throws Exception {
        String url = EXPORT + "/users" + RANGE;

        mockMvc.perform(get(url))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, userToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Unsupported section and dataset combinations return the JSON validation error format")
    void rejectsUnsupportedDatasetCombinations() throws Exception {
        assertJsonBadRequest(EXPORT + "/overview" + RANGE + "&dataset=timeseries");
        assertJsonBadRequest(EXPORT + "/users" + RANGE + "&dataset=top-requested");
        assertJsonBadRequest(EXPORT + "/reviews" + RANGE + "&dataset=top-requested");
        assertJsonBadRequest(EXPORT + "/users" + RANGE + "&dataset=unknown");
        assertJsonBadRequest(EXPORT + "/unknown-section" + RANGE);
        assertJsonBadRequest(EXPORT + "/users" + RANGE + "&dataset=");
    }

    @Test
    @DisplayName("Parameters that a section does not support return 400 without a CSV attachment")
    void rejectsUnsupportedParameters() throws Exception {
        List<String> urls = List.of(
                EXPORT + "/users" + RANGE + "&granularity=DAY",
                EXPORT + "/users" + RANGE + "&dataset=timeseries&status=ACTIVE",
                EXPORT + "/reviews" + RANGE + "&status=PENDING",
                EXPORT + "/transactions" + RANGE + "&granularity=DAY",
                EXPORT + "/listings" + RANGE + "&dataset=top-requested&granularity=DAY",
                EXPORT + "/listings" + RANGE + "&limit=5",
                EXPORT + "/moderation" + RANGE + "&dataset=timeseries&status=PENDING",
                EXPORT + "/users?from=2000-01-10&to=2000-01-03",
                EXPORT + "/users" + RANGE + "&timezone=Mars/Phobos",
                EXPORT + "/listings" + RANGE + "&dataset=top-requested&limit=0",
                EXPORT + "/users" + RANGE + "&status=ARCHIVED"
        );

        for (String url : urls) {
            assertJsonBadRequest(url);
        }
    }

    @Test
    @DisplayName("User summary CSV values and period metadata match the JSON reporting response")
    void usersCsvMatchesJsonMetrics() throws Exception {
        createUser("CSV Active", UserRole.USER, UserStatus.ACTIVE, Instant.parse("2000-01-04T03:00:00Z"));
        createUser("CSV Suspended", UserRole.ADMIN, UserStatus.SUSPENDED,
                Instant.parse("2000-01-05T03:00:00Z"));

        JsonNode json = getJson(BASE + "/users/summary" + RANGE);
        CsvDownload download = getCsv(EXPORT + "/users" + RANGE);
        List<List<String>> rows = parseCsv(download.body());

        assertThat(rows.get(0)).containsExactly(
                "section", "metric_key", "metric_label_vi", "dimension_key",
                "dimension_label_vi", "value", "period_from", "period_to",
                "timezone", "filters", "generated_at"
        );

        List<String> totalRow = rowByMetric(rows, "USER_REGISTRATIONS");
        assertThat(totalRow.get(5)).isEqualTo(json.at("/metrics/totalUsers").asText());
        assertThat(totalRow.get(6)).isEqualTo(json.at("/period/from").asText());
        assertThat(totalRow.get(7)).isEqualTo(json.at("/period/to").asText());
        assertThat(totalRow.get(8)).isEqualTo(json.at("/period/timezone").asText());
        assertThat(totalRow.get(9)).isEqualTo("{}");

        OffsetDateTime generatedAt = OffsetDateTime.parse(
                totalRow.get(10), DateTimeFormatter.ISO_OFFSET_DATE_TIME
        );
        assertThat(generatedAt.getOffset().getTotalSeconds()).isEqualTo(7 * 3600);

        for (JsonNode roleItem : json.at("/metrics/byRole")) {
            List<String> roleRow = rowByDimension(rows, "USER_ROLE_DISTRIBUTION", roleItem.get("key").asText());
            assertThat(roleRow.get(5)).isEqualTo(roleItem.get("value").asText());
        }
        for (JsonNode statusItem : json.at("/metrics/byStatus")) {
            List<String> statusRow = rowByDimension(
                    rows, "USER_STATUS_DISTRIBUTION", statusItem.get("key").asText()
            );
            assertThat(statusRow.get(5)).isEqualTo(statusItem.get("value").asText());
        }
    }

    @Test
    @DisplayName("Top requested CSV rows match the JSON ranking and serialize ranking metadata")
    void topRequestedCsvMatchesJson() throws Exception {
        Category category = createCategory("CSV Top Category", "csv-top-" + UUID.randomUUID());
        User owner = createUser("CSV Top Owner", UserRole.USER, UserStatus.ACTIVE, Instant.now());

        Listing first = createListing(owner, category, ListingType.SALE, ListingStatus.ACTIVE,
                "CSV Top First", Instant.parse("2000-01-01T03:00:00Z"));
        Listing second = createListing(owner, category, ListingType.GIVEAWAY, ListingStatus.ACTIVE,
                "CSV Top Second", Instant.parse("2000-01-01T04:00:00Z"));

        createRequest(first, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T03:00:00Z"));
        createRequest(first, ListingRequestStatus.ACCEPTED, Instant.parse("2000-01-04T04:00:00Z"));
        createRequest(second, ListingRequestStatus.REJECTED, Instant.parse("2000-01-05T03:00:00Z"));

        JsonNode json = getJson(BASE + "/listings/top-requested" + RANGE);
        CsvDownload download = getCsv(EXPORT + "/listings" + RANGE + "&dataset=top-requested");
        List<List<String>> rows = parseCsv(download.body());

        assertThat(rows.get(0)).containsExactly(
                "rank", "listing_id", "listing_title", "owner_id", "owner_display_name",
                "category_id", "category_name", "listing_type", "request_count",
                "period_from", "period_to", "timezone", "filters", "generated_at"
        );
        assertThat(rows).hasSize(json.at("/listings").size() + 1);

        for (int index = 0; index < json.at("/listings").size(); index++) {
            JsonNode item = json.at("/listings/" + index);
            List<String> row = rows.get(index + 1);

            assertThat(row.get(0)).isEqualTo(Integer.toString(index + 1));
            assertThat(row.get(1)).isEqualTo(item.get("listingId").asText());
            assertThat(row.get(2)).isEqualTo(item.get("title").asText());
            assertThat(row.get(3)).isEqualTo(item.get("ownerId").asText());
            assertThat(row.get(4)).isEqualTo(item.get("ownerDisplayName").asText());
            assertThat(row.get(5)).isEqualTo(item.get("categoryId").asText());
            assertThat(row.get(6)).isEqualTo(item.get("categoryName").asText());
            assertThat(row.get(7)).isEqualTo(item.get("listingType").asText());
            assertThat(row.get(8)).isEqualTo(item.get("requestCount").asText());
        }

        assertThat(rows.get(1).get(12)).isEqualTo(
                "{\"countedRequestStatuses\":[\"PENDING\",\"ACCEPTED\",\"REJECTED\"],\"limit\":10}"
        );
    }

    @Test
    @DisplayName("Support CSV exports aggregates only and never leaks support content or PII")
    void supportCsvExcludesSensitiveContent() throws Exception {
        SupportRequest support = new SupportRequest(
                regularUser,
                null,
                SupportCategory.TRANSACTION_ISSUE,
                "SENSITIVE_SUBJECT",
                "SENSITIVE_DESCRIPTION"
        );
        support.setAdminNotes("SENSITIVE_NOTES");
        support.setAdminResponse("SENSITIVE_RESPONSE");
        support.setCreatedAt(Instant.parse("2000-01-04T03:00:00Z"));
        supportRequestRepository.saveAndFlush(support);

        CsvDownload download = getCsv(EXPORT + "/support" + RANGE);
        String content = new String(download.body(), StandardCharsets.UTF_8);
        List<List<String>> rows = parseCsv(download.body());

        assertThat(rowByMetric(rows, "SUPPORT_REQUEST_CREATIONS").get(5)).isEqualTo("1");
        assertThat(rowByMetric(rows, "SUPPORT_CURRENT_OPEN_WORKLOAD_SCOPE").get(5))
                .isEqualTo("CURRENT_SYSTEM_WIDE_ALL_DATES");
        assertThat(rowsByMetric(rows, "SUPPORT_CURRENT_OPEN_WORKLOAD"))
                .extracting(row -> row.get(3))
                .containsExactly("PENDING", "IN_PROGRESS", "TOTAL_OPEN");

        assertThat(content).doesNotContain("SENSITIVE_SUBJECT");
        assertThat(content).doesNotContain("SENSITIVE_DESCRIPTION");
        assertThat(content).doesNotContain("SENSITIVE_NOTES");
        assertThat(content).doesNotContain("SENSITIVE_RESPONSE");
        assertThat(content).doesNotContain("@shareloop.vn");
        assertThat(content).doesNotContain(regularUser.getEmail());
    }

    @Test
    @DisplayName("Export rows protect spreadsheet formulas in user-controlled text")
    void neutralizesFormulaInjection() throws Exception {
        Category category = createCategory("-danger", "csv-danger-" + UUID.randomUUID());
        User owner = createUser("@SUM(1,1)", UserRole.USER, UserStatus.ACTIVE, Instant.now());
        Listing listing = createListing(owner, category, ListingType.SALE, ListingStatus.ACTIVE,
                "=HYPERLINK(\"http://evil\")", Instant.parse("2000-01-04T03:00:00Z"));
        createRequest(listing, ListingRequestStatus.PENDING, Instant.parse("2000-01-04T03:00:00Z"));

        List<List<String>> topRows = parseCsv(
                getCsv(EXPORT + "/listings" + RANGE + "&dataset=top-requested").body()
        );
        List<String> topRow = topRows.get(1);
        assertThat(topRow.get(2)).isEqualTo("'=HYPERLINK(\"http://evil\")");
        assertThat(topRow.get(4)).isEqualTo("'@SUM(1,1)");
        assertThat(topRow.get(6)).isEqualTo("'-danger");

        List<List<String>> summaryRows = parseCsv(getCsv(EXPORT + "/listings" + RANGE).body());
        List<String> categoryRow = rowByMetric(summaryRows, "LISTING_CATEGORY_DISTRIBUTION");
        assertThat(categoryRow.get(4)).isEqualTo("'-danger");
    }

    @Test
    @DisplayName("Review exports keep null averages as empty values instead of text")
    void reviewExportKeepsNullAveragesEmpty() throws Exception {
        CsvDownload download = getCsv(EXPORT + "/reviews" + RANGE);
        List<List<String>> rows = parseCsv(download.body());

        assertThat(rowByMetric(rows, "REVIEWS_AVERAGE_RATING_VISIBLE").get(5)).isEmpty();
        assertThat(rowByMetric(rows, "REVIEWS_AVERAGE_RATING_ALL").get(5)).isEmpty();
        assertThat(new String(download.body(), StandardCharsets.UTF_8)).doesNotContain("null");
    }

    // ==========================================
    // Helpers
    // ==========================================

    private void assertCsvEnvelope(CsvDownload download, String section) {
        byte[] body = download.body();
        assertThat(body.length).isGreaterThan(3);
        assertThat(body[0]).isEqualTo((byte) 0xEF);
        assertThat(body[1]).isEqualTo((byte) 0xBB);
        assertThat(body[2]).isEqualTo((byte) 0xBF);

        MockHttpServletResponse response = download.response();
        assertThat(response.getContentType()).startsWith("text/csv");
        assertThat(response.getContentType()).containsIgnoringCase("UTF-8");
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"shareloop-report-" + section
                        + "-2000-01-03-2000-01-10.csv\"");
        assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("private, no-store");
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
    }

    private void assertJsonBadRequest(String url) throws Exception {
        MvcResult result = mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest())
                .andReturn();

        MockHttpServletResponse response = result.getResponse();
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isNull();

        byte[] body = response.getContentAsByteArray();
        assertThat(body[0]).isNotEqualTo((byte) 0xEF);

        JsonNode error = objectMapper.readTree(body);
        assertThat(error.get("status").asInt()).isEqualTo(400);
        assertThat(error.get("path").asText()).isEqualTo(url.substring(0, url.indexOf('?')));
    }

    private CsvDownload getCsv(String url) throws Exception {
        MvcResult result = mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return new CsvDownload(result.getResponse().getContentAsByteArray(), result.getResponse());
    }

    private JsonNode getJson(String url) throws Exception {
        MvcResult result = mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private User createUser(String displayName, UserRole role, UserStatus status, Instant createdAt) {
        User user = new User(
                displayName,
                "csv.export." + UUID.randomUUID() + "@shareloop.vn",
                "test-password-hash",
                role,
                status
        );
        user.setCreatedAt(createdAt);
        return userRepository.saveAndFlush(user);
    }

    private Category createCategory(String name, String slug) {
        return categoryRepository.saveAndFlush(new Category(name, slug, "CSV export test category", true));
    }

    private Listing createListing(
            User owner,
            Category category,
            ListingType type,
            ListingStatus status,
            String title,
            Instant createdAt
    ) {
        Listing listing = new Listing(owner, category, type, title, "CSV export test listing", "Ha Noi");
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
                "CSV Requester " + UUID.randomUUID(),
                UserRole.USER,
                UserStatus.ACTIVE,
                Instant.now()
        );
        ListingRequest request = new ListingRequest(listing, requester, "CSV export test request", status);
        request.setCreatedAt(createdAt);
        return listingRequestRepository.saveAndFlush(request);
    }

    private static List<String> rowByMetric(List<List<String>> rows, String metricKey) {
        return rowsByMetric(rows, metricKey).get(0);
    }

    private static List<String> rowByDimension(
            List<List<String>> rows,
            String metricKey,
            String dimensionKey
    ) {
        return rows.stream()
                .filter(row -> metricKey.equals(row.get(1)) && dimensionKey.equals(row.get(3)))
                .findFirst()
                .orElseThrow();
    }

    private static List<List<String>> rowsByMetric(List<List<String>> rows, String metricKey) {
        List<List<String>> matches = new ArrayList<>();
        for (List<String> row : rows) {
            if (metricKey.equals(row.get(1))) {
                matches.add(row);
            }
        }
        return matches;
    }

    private static List<List<String>> parseCsv(byte[] bytes) {
        String content = new String(bytes, StandardCharsets.UTF_8);
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }

        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
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
                row = new ArrayList<>();
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

    private record CsvDownload(byte[] body, MockHttpServletResponse response) {
    }
}
