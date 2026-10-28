package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.report.CreateReportRequest;
import com.shareloop.dto.report.UpdateReportAdminRequest;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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
    private ReviewRepository reviewRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User alice;
    private User bob;
    private User charlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Category testCategory;
    private Listing bobListing;
    private Listing aliceListing;
    private ListingRequest testListingRequest;
    private Transaction testTransaction;
    private Review testReview;

    @BeforeEach
    void setUp() {
        alice = userRepository.saveAndFlush(new User(
                "Alice Reporter",
                "alice.rep." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        bob = userRepository.saveAndFlush(new User(
                "Bob Offender",
                "bob.rep." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        charlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.rep." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.rep." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(alice.getId(), alice.getEmail(), alice.getRole(), alice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(bob.getId(), bob.getEmail(), bob.getRole(), bob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(charlie.getId(), charlie.getEmail(), charlie.getRole(), charlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        testCategory = categoryRepository.saveAndFlush(new Category(
                "Cat-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));

        bobListing = listingRepository.saveAndFlush(new Listing(
                bob,
                testCategory,
                ListingType.GIVEAWAY,
                "Bob Item",
                "Description for Bob item",
                "Hồ Chí Minh"
        ));

        aliceListing = listingRepository.saveAndFlush(new Listing(
                alice,
                testCategory,
                ListingType.GIVEAWAY,
                "Alice Item",
                "Description for Alice item",
                "Hà Nội"
        ));

        testListingRequest = new ListingRequest(bobListing, alice, "Request for item", ListingRequestStatus.ACCEPTED);
        testListingRequest = listingRequestRepository.saveAndFlush(testListingRequest);

        testTransaction = new Transaction(testListingRequest, bobListing, bob, alice, TransactionStatus.PENDING);
        testTransaction.setStatus(TransactionStatus.COMPLETED);
        testTransaction.setOwnerCompleted(true);
        testTransaction.setOwnerCompletedAt(Instant.now());
        testTransaction.setRequesterCompleted(true);
        testTransaction.setRequesterCompletedAt(Instant.now());
        testTransaction = transactionRepository.saveAndFlush(testTransaction);

        testReview = new Review(testTransaction, bob, alice, 5, "Great exchange!");
        testReview = reviewRepository.saveAndFlush(testReview);
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        reportRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        if (testCategory != null && testCategory.getId() != null) {
            categoryRepository.deleteById(testCategory.getId());
        }
        userRepository.deleteAll();
    }

    @Nested
    @DisplayName("POST /api/v1/reports - Submit Violation Report")
    class CreateReportTests {

        @Test
        @DisplayName("Successfully report a user for harassment")
        void reportUser_Success() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.USER,
                    bob.getId(),
                    ReportCategory.HARASSMENT,
                    "This user sent abusive messages in chat."
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.reporterId").value(alice.getId().toString()))
                    .andExpect(jsonPath("$.targetType").value("USER"))
                    .andExpect(jsonPath("$.targetId").value(bob.getId().toString()))
                    .andExpect(jsonPath("$.category").value("HARASSMENT"))
                    .andExpect(jsonPath("$.status").value("PENDING"));
        }

        @Test
        @DisplayName("Successfully report a listing for prohibited items")
        void reportListing_Success() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.LISTING,
                    bobListing.getId(),
                    ReportCategory.PROHIBITED_ITEM,
                    "This listing contains restricted items."
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.targetType").value("LISTING"))
                    .andExpect(jsonPath("$.category").value("PROHIBITED_ITEM"));
        }

        @Test
        @DisplayName("Successfully report an authorized transaction for fraud or scam")
        void reportTransaction_Success() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.TRANSACTION,
                    testTransaction.getId(),
                    ReportCategory.FRAUD_OR_SCAM,
                    "Item given was defective and not as pictured."
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.targetType").value("TRANSACTION"))
                    .andExpect(jsonPath("$.category").value("FRAUD_OR_SCAM"));
        }

        @Test
        @DisplayName("Successfully report a review")
        void reportReview_Success() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.REVIEW,
                    testReview.getId(),
                    ReportCategory.OTHER,
                    "The review contains inappropriate content."
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.targetType").value("REVIEW"));
        }

        @Test
        @DisplayName("User reporting themselves is rejected with 400")
        void selfReportUser_Returns400() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.USER,
                    alice.getId(),
                    ReportCategory.HARASSMENT,
                    "Self report should be rejected."
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cannot report yourself")));
        }

        @Test
        @DisplayName("Owner reporting own listing is rejected with 400")
        void reportOwnListing_Returns400() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.LISTING,
                    aliceListing.getId(),
                    ReportCategory.ITEM_MISREPRESENTED,
                    "Cannot report own listing"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cannot report your own listing")));
        }

        @Test
        @DisplayName("Non-participant reporting transaction is rejected with 403")
        void nonParticipantReportingTransaction_Returns403() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.TRANSACTION,
                    testTransaction.getId(),
                    ReportCategory.FRAUD_OR_SCAM,
                    "I am charlie and I did not participate in this transaction"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, charlieToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("not authorized to report this transaction")));
        }

        @Test
        @DisplayName("Reviewer reporting own review is rejected with 400")
        void reportOwnReview_Returns400() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.REVIEW,
                    testReview.getId(), // Bob created testReview
                    ReportCategory.OTHER,
                    "Cannot report own review"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cannot report your own review")));
        }

        @Test
        @DisplayName("Duplicate active report against same target is rejected with 409 Conflict")
        void duplicateActiveReport_Returns409() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.USER,
                    bob.getId(),
                    ReportCategory.HARASSMENT,
                    "First active report"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());

            // Second identical active report
            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value(containsString("already have an active report")));
        }

        @Test
        @DisplayName("Allows reporting again if previous report was RESOLVED or DISMISSED")
        void allowsReportingAgainIfPreviousResolved() throws Exception {
            Report previousReport = new Report(
                    alice, ReportTargetType.USER, bob.getId(), ReportCategory.HARASSMENT, "Old resolved report"
            );
            previousReport.setStatus(ReportStatus.RESOLVED);
            reportRepository.saveAndFlush(previousReport);

            CreateReportRequest newRequest = new CreateReportRequest(
                    ReportTargetType.USER,
                    bob.getId(),
                    ReportCategory.HARASSMENT,
                    "New fresh harassment incident"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(newRequest)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.status").value("PENDING"));
        }

        @Test
        @DisplayName("Reporting nonexistent target returns 404")
        void nonExistentTarget_Returns404() throws Exception {
            CreateReportRequest request = new CreateReportRequest(
                    ReportTargetType.USER,
                    UUID.randomUUID(),
                    ReportCategory.HARASSMENT,
                    "User does not exist"
            );

            mockMvc.perform(post("/api/v1/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/v1/reports/my - List My Reports")
    class GetMyReportsTests {

        @Test
        @DisplayName("Returns only the reporter's own reports without admin resolution notes")
        void returnsOnlyMyReports() throws Exception {
            Report r1 = new Report(alice, ReportTargetType.USER, bob.getId(), ReportCategory.HARASSMENT, "Desc 1");
            r1.setResolutionNotes("Top secret internal admin investigation note");
            reportRepository.saveAndFlush(r1);

            reportRepository.saveAndFlush(new Report(
                    bob, ReportTargetType.USER, alice.getId(), ReportCategory.OTHER, "Bob report"
            ));

            mockMvc.perform(get("/api/v1/reports/my")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].description").value("Desc 1"))
                    // Verify resolutionNotes is not leaked
                    .andExpect(jsonPath("$.content[0].resolutionNotes").doesNotExist());
        }
    }

    @Nested
    @DisplayName("GET /api/v1/reports/{id} - View Report Details")
    class GetReportDetailsTests {

        @Test
        @DisplayName("Reporter can view own report details")
        void reporterCanViewOwnReport() throws Exception {
            Report r = reportRepository.saveAndFlush(new Report(
                    alice, ReportTargetType.LISTING, bobListing.getId(), ReportCategory.PROHIBITED_ITEM, "Details"
            ));

            mockMvc.perform(get("/api/v1/reports/{id}", r.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(r.getId().toString()))
                    .andExpect(jsonPath("$.resolutionNotes").doesNotExist());
        }

        @Test
        @DisplayName("Other user cannot view someone else's report (403)")
        void otherUserCannotView_Returns403() throws Exception {
            Report r = reportRepository.saveAndFlush(new Report(
                    alice, ReportTargetType.LISTING, bobListing.getId(), ReportCategory.PROHIBITED_ITEM, "Details"
            ));

            mockMvc.perform(get("/api/v1/reports/{id}", r.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("Admin Reports Endpoints (/api/v1/admin/reports)")
    class AdminReportTests {

        @Test
        @DisplayName("Non-admin user receives 403 on admin report endpoints")
        void nonAdminReceives403() throws Exception {
            mockMvc.perform(get("/api/v1/admin/reports")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Admin can list and filter reports by targetType and status")
        void adminCanListAndFilterReports() throws Exception {
            reportRepository.saveAndFlush(new Report(
                    alice, ReportTargetType.USER, bob.getId(), ReportCategory.HARASSMENT, "Report 1"
            ));
            reportRepository.saveAndFlush(new Report(
                    alice, ReportTargetType.LISTING, bobListing.getId(), ReportCategory.PROHIBITED_ITEM, "Report 2"
            ));

            mockMvc.perform(get("/api/v1/admin/reports")
                            .param("targetType", "USER")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].targetType").value("USER"));
        }

        @Test
        @DisplayName("Admin can inspect report with internal resolution notes and reporter email")
        void adminCanInspectReport() throws Exception {
            Report r = new Report(alice, ReportTargetType.USER, bob.getId(), ReportCategory.HARASSMENT, "Harassment report");
            r.setResolutionNotes("Admin noted: verified chat logs.");
            r = reportRepository.saveAndFlush(r);

            mockMvc.perform(get("/api/v1/admin/reports/{id}", r.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.resolutionNotes").value("Admin noted: verified chat logs."))
                    .andExpect(jsonPath("$.reporterEmail").value(alice.getEmail()));
        }

        @Test
        @DisplayName("Admin updates report status and notification is dispatched to reporter")
        void adminUpdatesReportStatusAndNotificationCreated() throws Exception {
            Report r = reportRepository.saveAndFlush(new Report(
                    alice, ReportTargetType.LISTING, bobListing.getId(), ReportCategory.PROHIBITED_ITEM, "Item report"
            ));

            UpdateReportAdminRequest updateRequest = new UpdateReportAdminRequest(
                    ReportStatus.RESOLVED,
                    "Listing has been reviewed and appropriate action was taken."
            );

            mockMvc.perform(patch("/api/v1/admin/reports/{id}", r.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("RESOLVED"))
                    .andExpect(jsonPath("$.resolutionNotes").value("Listing has been reviewed and appropriate action was taken."))
                    .andExpect(jsonPath("$.resolvedById").value(adminDave.getId().toString()))
                    .andExpect(jsonPath("$.resolvedAt").exists());

            // Verify notification created for alice
            var notifications = notificationRepository.findAll();
            assertThat(notifications).hasSize(1);
            Notification notif = notifications.get(0);
            assertThat(notif.getRecipient().getId()).isEqualTo(alice.getId());
            assertThat(notif.getType()).isEqualTo(NotificationType.REPORT_UPDATED);
            assertThat(notif.getReferenceType()).isEqualTo("REPORT");
            assertThat(notif.getReferenceId()).isEqualTo(r.getId());
            assertThat(notif.getMessage()).contains("Báo cáo vi phạm tin đăng của bạn");
        }
    }
}
