package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.support.CreateSupportRequest;
import com.shareloop.dto.support.UpdateSupportRequestAdminRequest;
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
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SupportRequestIntegrationTest {

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
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User alice;
    private User bob;
    private User outsiderCharlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Transaction testTransaction;
    private Category testCategory;
    private Listing testListing;
    private ListingRequest testListingRequest;

    @BeforeEach
    void setUp() {
        alice = userRepository.saveAndFlush(new User(
                "Alice Requester",
                "alice.sup." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        bob = userRepository.saveAndFlush(new User(
                "Bob Partner",
                "bob.sup." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        outsiderCharlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.sup." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.sup." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(alice.getId(), alice.getEmail(), alice.getRole(), alice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(bob.getId(), bob.getEmail(), bob.getRole(), bob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(outsiderCharlie.getId(), outsiderCharlie.getEmail(), outsiderCharlie.getRole(), outsiderCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        testCategory = categoryRepository.saveAndFlush(new Category(
                "Cat-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Test Category",
                true
        ));

        testListing = new Listing(
                alice,
                testCategory,
                ListingType.GIVEAWAY,
                "Test item for support",
                "Detailed description of test item",
                "Hà Nội"
        );
        testListing = listingRepository.saveAndFlush(testListing);

        testListingRequest = new ListingRequest(testListing, bob, "Request message", ListingRequestStatus.ACCEPTED);
        testListingRequest = listingRequestRepository.saveAndFlush(testListingRequest);

        testTransaction = new Transaction(testListingRequest, testListing, alice, bob, TransactionStatus.PENDING);
        testTransaction = transactionRepository.saveAndFlush(testTransaction);
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        supportRequestRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        if (testCategory != null && testCategory.getId() != null) {
            categoryRepository.deleteById(testCategory.getId());
        }
        userRepository.deleteAll();
    }

    @Nested
    @DisplayName("POST /api/v1/support-requests - Create Support Request")
    class CreateSupportRequestTests {

        @Test
        @DisplayName("Authenticated user creates support request without transaction successfully")
        void createSupportRequestWithoutTransaction_Success() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    null,
                    SupportCategory.ACCOUNT_ISSUE,
                    "Cannot update my profile picture",
                    "Whenever I upload my avatar, it says upload error."
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.requesterId").value(alice.getId().toString()))
                    .andExpect(jsonPath("$.requesterDisplayName").value(alice.getDisplayName()))
                    .andExpect(jsonPath("$.transactionId").doesNotExist())
                    .andExpect(jsonPath("$.category").value("ACCOUNT_ISSUE"))
                    .andExpect(jsonPath("$.subject").value("Cannot update my profile picture"))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.adminResponse").doesNotExist());
        }

        @Test
        @DisplayName("Authorized participant creates support request referencing transaction successfully")
        void createSupportRequestWithTransaction_Success() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    testTransaction.getId(),
                    SupportCategory.TRANSACTION_ISSUE,
                    "Partner didn't show up at meetup",
                    "We agreed to meet at 10 AM, but Bob did not arrive."
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.requesterId").value(alice.getId().toString()))
                    .andExpect(jsonPath("$.transactionId").value(testTransaction.getId().toString()))
                    .andExpect(jsonPath("$.category").value("TRANSACTION_ISSUE"))
                    .andExpect(jsonPath("$.status").value("PENDING"));
        }

        @Test
        @DisplayName("Non-participant rejected with 403 when referencing transaction")
        void nonParticipantReferencingTransaction_Returns403() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    testTransaction.getId(),
                    SupportCategory.TRANSACTION_ISSUE,
                    "I want info on this transaction",
                    "I am an outsider wanting details."
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, charlieToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("not authorized to create a support request for this transaction")));
        }

        @Test
        @DisplayName("Nonexistent transaction returns 404")
        void nonexistentTransaction_Returns404() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    UUID.randomUUID(),
                    SupportCategory.TRANSACTION_ISSUE,
                    "Invalid transaction",
                    "Some description"
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Validation failure on blank subject and missing category returns 400")
        void validationFailure_Returns400() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    null,
                    null,
                    "   ",
                    "Valid description"
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.category").exists())
                    .andExpect(jsonPath("$.errors.subject").exists());
        }

        @Test
        @DisplayName("Unauthenticated request returns 401")
        void unauthenticated_Returns401() throws Exception {
            CreateSupportRequest request = new CreateSupportRequest(
                    null,
                    SupportCategory.OTHER,
                    "Question about fees",
                    "Are there any listing fees?"
            );

            mockMvc.perform(post("/api/v1/support-requests")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/v1/support-requests/my - List My Support Requests")
    class GetMySupportRequestsTests {

        @Test
        @DisplayName("Returns only the authenticated user's requests")
        void returnsOnlyMyRequests() throws Exception {
            SupportRequest aliceReq1 = supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.ACCOUNT_ISSUE, "Alice Subj 1", "Alice Desc 1"
            ));
            SupportRequest aliceReq2 = supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.SAFETY_CONCERN, "Alice Subj 2", "Alice Desc 2"
            ));
            SupportRequest bobReq = supportRequestRepository.saveAndFlush(new SupportRequest(
                    bob, null, SupportCategory.OTHER, "Bob Subj", "Bob Desc"
            ));

            mockMvc.perform(get("/api/v1/support-requests/my")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(2))
                    .andExpect(jsonPath("$.content[*].subject", containsInAnyOrder("Alice Subj 1", "Alice Subj 2")));
        }

        @Test
        @DisplayName("Filters by status correctly")
        void filtersByStatus() throws Exception {
            SupportRequest pendingReq = supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.ACCOUNT_ISSUE, "Pending Subj", "Desc"
            ));
            SupportRequest resolvedReq = new SupportRequest(
                    alice, null, SupportCategory.OTHER, "Resolved Subj", "Desc"
            );
            resolvedReq.setStatus(SupportRequestStatus.RESOLVED);
            supportRequestRepository.saveAndFlush(resolvedReq);

            mockMvc.perform(get("/api/v1/support-requests/my")
                            .param("status", "RESOLVED")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].subject").value("Resolved Subj"));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/support-requests/{id} - View Support Request Details")
    class GetSupportRequestDetailsTests {

        @Test
        @DisplayName("Requester can view own support request without internal admin notes")
        void requesterCanViewOwnRequest() throws Exception {
            SupportRequest sr = new SupportRequest(
                    alice, null, SupportCategory.OTHER, "General query", "Description text"
            );
            sr.setAdminResponse("Here is your answer from admin.");
            sr.setAdminNotes("Internal secret note for admins only");
            sr = supportRequestRepository.saveAndFlush(sr);

            mockMvc.perform(get("/api/v1/support-requests/{id}", sr.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(sr.getId().toString()))
                    .andExpect(jsonPath("$.adminResponse").value("Here is your answer from admin."))
                    // Verify adminNotes is strictly not exposed
                    .andExpect(jsonPath("$.adminNotes").doesNotExist());
        }

        @Test
        @DisplayName("Another regular user cannot view someone else's support request (403)")
        void otherUserCannotView_Returns403() throws Exception {
            SupportRequest sr = supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.OTHER, "Private query", "Private text"
            ));

            mockMvc.perform(get("/api/v1/support-requests/{id}", sr.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("not authorized to view this support request")));
        }
    }

    @Nested
    @DisplayName("Admin Support Request Endpoints (/api/v1/admin/support-requests)")
    class AdminSupportRequestTests {

        @Test
        @DisplayName("Non-admin user receives 403 on admin endpoints")
        void nonAdminReceives403() throws Exception {
            mockMvc.perform(get("/api/v1/admin/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Admin can list and filter all support requests")
        void adminCanListAndFilterRequests() throws Exception {
            supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.TRANSACTION_ISSUE, "Alice Issue", "Desc"
            ));
            supportRequestRepository.saveAndFlush(new SupportRequest(
                    bob, null, SupportCategory.SAFETY_CONCERN, "Bob Issue", "Desc"
            ));

            mockMvc.perform(get("/api/v1/admin/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(2));

            mockMvc.perform(get("/api/v1/admin/support-requests")
                            .param("category", "TRANSACTION_ISSUE")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].subject").value("Alice Issue"));
        }

        @Test
        @DisplayName("Admin can inspect details with internal admin notes and user email")
        void adminCanInspectDetails() throws Exception {
            SupportRequest sr = new SupportRequest(
                    alice, null, SupportCategory.OTHER, "Subject", "Desc"
            );
            sr.setAdminNotes("Internal admin review note");
            sr = supportRequestRepository.saveAndFlush(sr);

            mockMvc.perform(get("/api/v1/admin/support-requests/{id}", sr.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.adminNotes").value("Internal admin review note"))
                    .andExpect(jsonPath("$.requesterEmail").value(alice.getEmail()));
        }

        @Test
        @DisplayName("Admin updates status to RESOLVED, adds response & notes, and notification is dispatched")
        void adminUpdatesStatusAndNotificationCreated() throws Exception {
            SupportRequest sr = supportRequestRepository.saveAndFlush(new SupportRequest(
                    alice, null, SupportCategory.ACCOUNT_ISSUE, "Need email change", "I want to change my email"
            ));

            UpdateSupportRequestAdminRequest updateRequest = new UpdateSupportRequestAdminRequest(
                    SupportRequestStatus.RESOLVED,
                    "Your email change request has been approved.",
                    "Verified user identity via document"
            );

            mockMvc.perform(patch("/api/v1/admin/support-requests/{id}", sr.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("RESOLVED"))
                    .andExpect(jsonPath("$.adminResponse").value("Your email change request has been approved."))
                    .andExpect(jsonPath("$.adminNotes").value("Verified user identity via document"))
                    .andExpect(jsonPath("$.resolvedById").value(adminDave.getId().toString()))
                    .andExpect(jsonPath("$.resolvedAt").exists());

            // Verify notification created for alice
            var notifications = notificationRepository.findAll();
            assertThat(notifications).hasSize(1);
            Notification notif = notifications.get(0);
            assertThat(notif.getRecipient().getId()).isEqualTo(alice.getId());
            assertThat(notif.getType()).isEqualTo(NotificationType.SUPPORT_REQUEST_UPDATED);
            assertThat(notif.getReferenceType()).isEqualTo("SUPPORT_REQUEST");
            assertThat(notif.getReferenceId()).isEqualTo(sr.getId());
            assertThat(notif.getMessage()).contains("Need email change");
        }
    }
}
