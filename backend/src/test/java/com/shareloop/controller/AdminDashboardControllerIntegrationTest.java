package com.shareloop.controller;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminDashboardControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User admin;
    private User normalUser;
    private String adminToken;
    private String userToken;
    private final List<UUID> testCategoryIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        cleanDatabase();

        admin = userRepository.saveAndFlush(new User(
                "Super Admin",
                "admin.stats." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("SecureAdminPassword123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        normalUser = userRepository.saveAndFlush(new User(
                "Normal User",
                "user.stats." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("UserPassword123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminToken = "Bearer " + jwtService.generateToken(admin.getId(), admin.getEmail(), admin.getRole(), admin.getStatus());
        userToken = "Bearer " + jwtService.generateToken(normalUser.getId(), normalUser.getEmail(), normalUser.getRole(), normalUser.getStatus());
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    private void cleanDatabase() {
        notificationRepository.deleteAll();
        reportRepository.deleteAll();
        reviewRepository.deleteAll();
        supportRequestRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        if (!testCategoryIds.isEmpty()) {
            categoryRepository.deleteAllById(testCategoryIds);
            testCategoryIds.clear();
        }
        userRepository.deleteAll();
    }

    private Category createTestCategory(String name, String slug, String description, boolean isActive) {
        Category category = categoryRepository.saveAndFlush(new Category(name, slug, description, isActive));
        testCategoryIds.add(category.getId());
        return category;
    }

    @Test
    @DisplayName("GET /api/v1/admin/dashboard/stats without token returns 401 Unauthorized")
    void getStats_anonymous_returns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/v1/admin/dashboard/stats with USER role returns 403 Forbidden")
    void getStats_userRole_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/v1/admin/dashboard/stats with ADMIN role and clean data returns valid zeros")
    void getStats_adminRole_cleanData_returnsValidZeros() throws Exception {
        long baselineCategories = categoryRepository.count();
        assertThat(baselineCategories).isGreaterThanOrEqualTo(9L);

        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers", is(2))) // admin + normalUser
                .andExpect(jsonPath("$.activeUsers", is(2)))
                .andExpect(jsonPath("$.suspendedUsers", is(0)))
                .andExpect(jsonPath("$.totalListings", is(0)))
                .andExpect(jsonPath("$.activeListings", is(0)))
                .andExpect(jsonPath("$.totalTransactions", is(0)))
                .andExpect(jsonPath("$.completedTransactions", is(0)))
                .andExpect(jsonPath("$.totalCategories", is((int) baselineCategories)))
                .andExpect(jsonPath("$.pendingSupportRequests", is(0)))
                .andExpect(jsonPath("$.inProgressSupportRequests", is(0)))
                .andExpect(jsonPath("$.pendingReports", is(0)))
                .andExpect(jsonPath("$.investigatingReports", is(0)));
    }

    @Test
    @DisplayName("GET /api/v1/admin/dashboard/stats returns accurate metrics across all domain statuses")
    void getStats_adminRole_populatedData_returnsAccurateCounts() throws Exception {
        long initialCategories = categoryRepository.count();

        // 1. Extra Users: 1 active, 1 suspended, 1 deactivated
        userRepository.saveAndFlush(new User("Active Extra", "active." + UUID.randomUUID() + "@test.org", passwordEncoder.encode("pass"), UserRole.USER, UserStatus.ACTIVE));
        userRepository.saveAndFlush(new User("Suspended One", "suspended." + UUID.randomUUID() + "@test.org", passwordEncoder.encode("pass"), UserRole.USER, UserStatus.SUSPENDED));
        userRepository.saveAndFlush(new User("Deactivated One", "deactivated." + UUID.randomUUID() + "@test.org", passwordEncoder.encode("pass"), UserRole.USER, UserStatus.DEACTIVATED));
        // Total users now = 2 (admin, normalUser) + 3 = 5; active = 3; suspended = 1

        // 2. Categories
        Category catBooks = createTestCategory("Books", "books-" + UUID.randomUUID(), "Books desc", true);
        Category catTools = createTestCategory("Tools", "tools-" + UUID.randomUUID(), "Tools desc", true);
        Category catInactive = createTestCategory("Archived", "archived-" + UUID.randomUUID(), "Archived desc", false);
        // Total categories = 3

        // 3. Listings: 2 ACTIVE, 1 DRAFT, 1 COMPLETED
        Listing l1 = new Listing(normalUser, catBooks, ListingType.GIVEAWAY, "Clean Book", "Desc", "Hà Nội");
        l1.setStatus(ListingStatus.ACTIVE);
        listingRepository.saveAndFlush(l1);

        Listing l2 = new Listing(normalUser, catTools, ListingType.SALE, "Hand Drill", "Desc", "Hồ Chí Minh");
        l2.setPrice(new java.math.BigDecimal("150000.00"));
        l2.setCurrency("VND");
        l2.setStatus(ListingStatus.ACTIVE);
        listingRepository.saveAndFlush(l2);

        Listing l3 = new Listing(normalUser, catBooks, ListingType.WANTED, "Draft Listing", "Desc", "Đà Nẵng");
        l3.setStatus(ListingStatus.DRAFT);
        listingRepository.saveAndFlush(l3);

        Listing l4 = new Listing(normalUser, catTools, ListingType.GIVEAWAY, "Completed Listing", "Desc", "Hà Nội");
        l4.setStatus(ListingStatus.COMPLETED);
        listingRepository.saveAndFlush(l4);
        // Total listings = 4, active listings = 2

        // 4. Listing Requests & Transactions: 2 COMPLETED, 1 IN_PROGRESS
        java.time.Instant now = java.time.Instant.now();

        ListingRequest lr1 = listingRequestRepository.saveAndFlush(new ListingRequest(l1, admin, "Req 1", ListingRequestStatus.ACCEPTED));
        Transaction t1 = new Transaction(lr1, l1, normalUser, admin, TransactionStatus.COMPLETED);
        t1.setOwnerCompleted(true);
        t1.setOwnerCompletedAt(now);
        t1.setRequesterCompleted(true);
        t1.setRequesterCompletedAt(now);
        transactionRepository.saveAndFlush(t1);

        ListingRequest lr2 = listingRequestRepository.saveAndFlush(new ListingRequest(l2, admin, "Req 2", ListingRequestStatus.ACCEPTED));
        Transaction t2 = new Transaction(lr2, l2, normalUser, admin, TransactionStatus.COMPLETED);
        t2.setOwnerCompleted(true);
        t2.setOwnerCompletedAt(now);
        t2.setRequesterCompleted(true);
        t2.setRequesterCompletedAt(now);
        transactionRepository.saveAndFlush(t2);

        ListingRequest lr3 = listingRequestRepository.saveAndFlush(new ListingRequest(l4, admin, "Req 3", ListingRequestStatus.ACCEPTED));
        Transaction t3 = new Transaction(lr3, l4, normalUser, admin, TransactionStatus.IN_PROGRESS);
        transactionRepository.saveAndFlush(t3);
        // Total transactions = 3, completed = 2

        // 5. Support Requests: 2 PENDING, 1 IN_PROGRESS, 1 RESOLVED
        SupportRequest sr1 = new SupportRequest(normalUser, null, SupportCategory.TRANSACTION_ISSUE, "Sub 1", "Desc 1");
        sr1.setStatus(SupportRequestStatus.PENDING);
        supportRequestRepository.saveAndFlush(sr1);

        SupportRequest sr2 = new SupportRequest(normalUser, null, SupportCategory.ACCOUNT_ISSUE, "Sub 2", "Desc 2");
        sr2.setStatus(SupportRequestStatus.PENDING);
        supportRequestRepository.saveAndFlush(sr2);

        SupportRequest sr3 = new SupportRequest(normalUser, null, SupportCategory.SAFETY_CONCERN, "Sub 3", "Desc 3");
        sr3.setStatus(SupportRequestStatus.IN_PROGRESS);
        supportRequestRepository.saveAndFlush(sr3);

        SupportRequest sr4 = new SupportRequest(normalUser, null, SupportCategory.OTHER, "Sub 4", "Desc 4");
        sr4.setStatus(SupportRequestStatus.RESOLVED);
        supportRequestRepository.saveAndFlush(sr4);
        // Pending support = 2, in progress = 1

        // 6. Reports: 3 PENDING, 2 INVESTIGATING, 1 RESOLVED (each active report has unique target per reporter)
        Report rep1 = new Report(normalUser, ReportTargetType.USER, admin.getId(), ReportCategory.FRAUD_OR_SCAM, "Scam");
        rep1.setStatus(ReportStatus.PENDING);
        reportRepository.saveAndFlush(rep1);

        Report rep2 = new Report(normalUser, ReportTargetType.LISTING, l1.getId(), ReportCategory.ITEM_MISREPRESENTED, "Bad");
        rep2.setStatus(ReportStatus.PENDING);
        reportRepository.saveAndFlush(rep2);

        Report rep3 = new Report(normalUser, ReportTargetType.TRANSACTION, t1.getId(), ReportCategory.NO_SHOW_OR_UNRESPONSIVE, "Off");
        rep3.setStatus(ReportStatus.PENDING);
        reportRepository.saveAndFlush(rep3);

        Report rep4 = new Report(normalUser, ReportTargetType.LISTING, l3.getId(), ReportCategory.HARASSMENT, "Harass");
        rep4.setStatus(ReportStatus.INVESTIGATING);
        reportRepository.saveAndFlush(rep4);

        Report rep5 = new Report(normalUser, ReportTargetType.LISTING, l2.getId(), ReportCategory.PROHIBITED_ITEM, "Prohibited");
        rep5.setStatus(ReportStatus.INVESTIGATING);
        reportRepository.saveAndFlush(rep5);

        Report rep6 = new Report(normalUser, ReportTargetType.LISTING, l4.getId(), ReportCategory.OTHER, "Other");
        rep6.setStatus(ReportStatus.RESOLVED);
        reportRepository.saveAndFlush(rep6);
        // Pending reports = 3, investigating reports = 2

        // Verify endpoint response
        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers", is(5)))
                .andExpect(jsonPath("$.activeUsers", is(3)))
                .andExpect(jsonPath("$.suspendedUsers", is(1)))
                .andExpect(jsonPath("$.totalListings", is(4)))
                .andExpect(jsonPath("$.activeListings", is(2)))
                .andExpect(jsonPath("$.totalTransactions", is(3)))
                .andExpect(jsonPath("$.completedTransactions", is(2)))
                .andExpect(jsonPath("$.totalCategories", is((int) (initialCategories + 3))))
                .andExpect(jsonPath("$.pendingSupportRequests", is(2)))
                .andExpect(jsonPath("$.inProgressSupportRequests", is(1)))
                .andExpect(jsonPath("$.pendingReports", is(3)))
                .andExpect(jsonPath("$.investigatingReports", is(2)));
    }
}
