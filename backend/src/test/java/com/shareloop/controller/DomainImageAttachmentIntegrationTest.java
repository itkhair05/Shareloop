package com.shareloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Phase C integration coverage for optional images on reviews, moderation
 * reports, and support requests. Runs against the real PostgreSQL test database
 * so the V24 binding trigger and the V22/V23 global registry are exercised.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DomainImageAttachmentIntegrationTest {

    private static final String REVIEW_DOMAIN = "REVIEW";
    private static final String REPORT_DOMAIN = "REPORT";
    private static final String SUPPORT_DOMAIN = "SUPPORT";

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
    private ReviewRepository reviewRepository;

    @Autowired
    private ReviewImageRepository reviewImageRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReportAttachmentRepository reportAttachmentRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private SupportRequestAttachmentRepository supportRequestAttachmentRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UploadedFileBindingRepository uploadedFileBindingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private LocalStorageService localStorageService;

    private User ownerAlice;
    private User requesterBob;
    private User outsiderCharlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Category category;
    private Transaction completedTransaction;

    private final Set<String> uploadedFilenames = new HashSet<>();
    private final List<UUID> uploadedFileIds = new ArrayList<>();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());

        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.att." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.att." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        outsiderCharlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.att." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.att." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(
                ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(
                requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(
                outsiderCharlie.getId(), outsiderCharlie.getEmail(), outsiderCharlie.getRole(), outsiderCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(
                adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        category = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Attachment category",
                true
        ));

        completedTransaction = createCompletedTransaction();
    }

    @AfterEach
    void tearDown() {
        TestStorageSupport.deleteOwnedFiles(localStorageService.getRootPath(), uploadedFilenames);
        uploadedFilenames.clear();

        reviewImageRepository.deleteAll();
        reportAttachmentRepository.deleteAll();
        supportRequestAttachmentRepository.deleteAll();
        uploadedFileBindingRepository.deleteAll();
        for (UUID fileId : uploadedFileIds) {
            if (uploadedFileRepository.existsById(fileId)) {
                uploadedFileRepository.deleteById(fileId);
            }
        }
        uploadedFileIds.clear();

        notificationRepository.deleteAll();
        reviewRepository.deleteAll();
        reportRepository.deleteAll();
        supportRequestRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        if (category != null && categoryRepository.existsById(category.getId())) {
            categoryRepository.deleteById(category.getId());
        }
        userRepository.deleteAll();
    }

    // =========================================================================
    // Shared attachment binding rules
    // =========================================================================

    @Nested
    @DisplayName("Shared binding contract")
    class SharedBindingContract {

        @Test
        @DisplayName("Review attachments preserve caller order and create one global binding per file")
        void reviewAttachmentsPreserveCallerOrder() throws Exception {
            Uploaded first = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            Uploaded second = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            Uploaded third = upload(requesterBob, bobToken, UploadPurpose.REVIEW);

            MvcResult result = createReview(bobToken, completedTransaction.getId(), "Great handover",
                    List.of(third.id(), first.id(), second.id())).andExpect(status().isCreated()).andReturn();

            UUID reviewId = UUID.fromString(read(result, "id"));
            JsonNode images = objectMapper.readTree(result.getResponse().getContentAsString()).get("images");
            assertThat(images.size()).isEqualTo(3);
            assertThat(images.get(0).get("id").asText()).isEqualTo(third.id().toString());
            assertThat(images.get(1).get("id").asText()).isEqualTo(first.id().toString());
            assertThat(images.get(2).get("id").asText()).isEqualTo(second.id().toString());
            assertThat(images.get(0).get("url").asText())
                    .isEqualTo("/api/v1/review-images/" + third.id());

            List<ReviewImage> stored = reviewImageRepository.findByReviewIdOrderByDisplayOrderAsc(reviewId);
            assertThat(stored).extracting(ReviewImage::getFileId)
                    .containsExactly(third.id(), first.id(), second.id());
            assertThat(stored).extracting(ReviewImage::getDisplayOrder)
                    .containsExactly(0, 1, 2);

            List<UploadedFileBinding> bindings = uploadedFileBindingRepository
                    .findByBoundDomainAndBoundEntityIdOrderByCreatedAtAsc(REVIEW_DOMAIN, reviewId);
            assertThat(bindings).hasSize(3);
            assertThat(bindings).extracting(UploadedFileBinding::getFileId)
                    .containsExactlyInAnyOrder(third.id(), first.id(), second.id());
            assertThat(bindings).allMatch(b -> b.getBoundBy().getId().equals(requesterBob.getId()));
        }

        @Test
        @DisplayName("Review without images still works and creates no attachments or bindings")
        void reviewWithoutImagesWorks() throws Exception {
            MvcResult result = createReview(bobToken, completedTransaction.getId(), "No photos", null)
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.images", hasSize(0)))
                    .andReturn();

            UUID reviewId = UUID.fromString(read(result, "id"));
            assertThat(reviewImageRepository.findByReviewIdOrderByDisplayOrderAsc(reviewId)).isEmpty();
            assertThat(uploadedFileBindingRepository
                    .findByBoundDomainAndBoundEntityIdOrderByCreatedAtAsc(REVIEW_DOMAIN, reviewId)).isEmpty();
        }

        @Test
        @DisplayName("Review rejects more than three images before persisting anything")
        void reviewRejectsTooManyImages() throws Exception {
            List<UUID> imageIds = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                imageIds.add(upload(requesterBob, bobToken, UploadPurpose.REVIEW).id());
            }

            createReview(bobToken, completedTransaction.getId(), "Too many", imageIds)
                    .andExpect(status().isBadRequest());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
            assertThat(reviewImageRepository.count()).isZero();
        }

        @Test
        @DisplayName("Review rejects duplicate file IDs")
        void reviewRejectsDuplicateFileIds() throws Exception {
            UUID fileId = upload(requesterBob, bobToken, UploadPurpose.REVIEW).id();

            createReview(bobToken, completedTransaction.getId(), "Duplicate", List.of(fileId, fileId))
                    .andExpect(status().isBadRequest());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
            assertThat(reviewImageRepository.count()).isZero();
        }

        @Test
        @DisplayName("Review rejects a file owned by another user without leaving partial state")
        void reviewRejectsForeignFile() throws Exception {
            UUID aliceFile = upload(ownerAlice, aliceToken, UploadPurpose.REVIEW).id();

            createReview(bobToken, completedTransaction.getId(), "Not mine", List.of(aliceFile))
                    .andExpect(status().isForbidden());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
            assertThat(reviewImageRepository.count()).isZero();
        }

        @Test
        @DisplayName("Review rejects a file whose purpose does not match the domain")
        void reviewRejectsWrongPurpose() throws Exception {
            UUID generalFile = upload(requesterBob, bobToken, UploadPurpose.GENERAL).id();

            createReview(bobToken, completedTransaction.getId(), "Wrong purpose", List.of(generalFile))
                    .andExpect(status().isBadRequest());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
        }

        @Test
        @DisplayName("Review rejects an already-bound file with 409 and keeps the original binding")
        void reviewRejectsAlreadyBoundFile() throws Exception {
            UUID fileId = upload(requesterBob, bobToken, UploadPurpose.REVIEW).id();

            MvcResult first = createReview(bobToken, completedTransaction.getId(), "First", List.of(fileId))
                    .andExpect(status().isCreated())
                    .andReturn();
            UUID firstReviewId = UUID.fromString(read(first, "id"));

            Transaction secondTransaction = createCompletedTransaction();

            createReview(bobToken, secondTransaction.getId(), "Second", List.of(fileId))
                    .andExpect(status().isConflict());

            assertThat(reviewRepository.findByTransactionIdAndReviewerId(
                    secondTransaction.getId(), requesterBob.getId())).isEmpty();
            assertThat(uploadedFileBindingRepository.findByFileId(fileId))
                    .hasValueSatisfying(binding -> {
                        assertThat(binding.getBoundEntityId()).isEqualTo(firstReviewId);
                        assertThat(binding.getBoundDomain()).isEqualTo(REVIEW_DOMAIN);
                    });
        }

        @Test
        @DisplayName("Review rejects a pending-deletion file with 409")
        void reviewRejectsPendingDeletionFile() throws Exception {
            Uploaded file = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            UploadedFile entity = uploadedFileRepository.findById(file.id()).orElseThrow();
            entity.markPendingDeletion(Instant.now());
            uploadedFileRepository.saveAndFlush(entity);

            createReview(bobToken, completedTransaction.getId(), "Pending deletion", List.of(file.id()))
                    .andExpect(status().isConflict());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.existsById(file.id())).isFalse();
        }

        @Test
        @DisplayName("A partial multi-file failure rolls back the review, all bindings, and all attachment rows")
        void partialBindingFailureRollsBackEverything() throws Exception {
            UUID bobFile = upload(requesterBob, bobToken, UploadPurpose.REVIEW).id();
            UUID aliceFile = upload(ownerAlice, aliceToken, UploadPurpose.REVIEW).id();

            createReview(bobToken, completedTransaction.getId(), "Mixed ownership",
                    List.of(bobFile, aliceFile))
                    .andExpect(status().isForbidden());

            assertThat(reviewRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
            assertThat(reviewImageRepository.count()).isZero();
        }

        @Test
        @DisplayName("A review-purpose file cannot be attached to a report")
        void reviewPurposeFileCannotBeAttachedToReport() throws Exception {
            UUID reviewFile = upload(requesterBob, bobToken, UploadPurpose.REVIEW).id();

            createReport(bobToken, ownerAlice.getId(), List.of(reviewFile))
                    .andExpect(status().isBadRequest());

            assertThat(reportRepository.count()).isZero();
            assertThat(uploadedFileBindingRepository.count()).isZero();
            assertThat(reportAttachmentRepository.count()).isZero();
        }

        @Test
        @DisplayName("The database rejects an attachment row without the matching global binding")
        void databaseRejectsAttachmentWithoutBinding() throws Exception {
            Uploaded file = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            Review review = reviewRepository.saveAndFlush(new Review(
                    completedTransaction, requesterBob, ownerAlice, 5, "Direct insert probe"));

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO review_images (file_id, review_id, display_order) VALUES (?, ?, 0)",
                    file.id(), review.getId()))
                    .isInstanceOf(DataAccessException.class);
        }
    }

    // =========================================================================
    // Review image visibility
    // =========================================================================

    @Nested
    @DisplayName("Review image visibility")
    class ReviewImageVisibility {

        @Test
        @DisplayName("Public callers can fetch images of a visible review and see them in profile responses")
        void publicVisibleReviewImage() throws Exception {
            Uploaded file = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            MvcResult created = createReview(bobToken, completedTransaction.getId(), "Visible", List.of(file.id()))
                    .andExpect(status().isCreated())
                    .andReturn();
            UUID reviewId = UUID.fromString(read(created, "id"));

            MvcResult imageResult = mockMvc.perform(get("/api/v1/review-images/{fileId}", file.id()))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("image/png")))
                    .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                    .andReturn();
            assertThat(imageResult.getResponse().getContentAsByteArray()).isNotEmpty();

            mockMvc.perform(get("/api/v1/users/{userId}/reviews", ownerAlice.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].id", is(reviewId.toString())))
                    .andExpect(jsonPath("$.content[0].images[0].id", is(file.id().toString())))
                    .andExpect(jsonPath("$.content[0].images[0].url",
                            is("/api/v1/review-images/" + file.id())));

            mockMvc.perform(get("/api/v1/transactions/{transactionId}/reviews", completedTransaction.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].images[0].id", is(file.id().toString())));
        }

        @Test
        @DisplayName("Hidden review images are 404 for the public and participants but visible to administrators")
        void hiddenReviewImageIsRestricted() throws Exception {
            Uploaded file = upload(requesterBob, bobToken, UploadPurpose.REVIEW);
            MvcResult created = createReview(bobToken, completedTransaction.getId(), "Will be hidden",
                    List.of(file.id())).andExpect(status().isCreated()).andReturn();
            UUID reviewId = UUID.fromString(read(created, "id"));

            mockMvc.perform(delete("/api/v1/admin/reviews/{reviewId}", reviewId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("reason", "Inappropriate content")))
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/v1/review-images/{fileId}", file.id()))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/review-images/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/review-images/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/v1/users/{userId}/reviews", ownerAlice.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(0)));

            mockMvc.perform(get("/api/v1/admin/reviews/{reviewId}", reviewId)
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isHidden", is(true)))
                    .andExpect(jsonPath("$.images[0].id", is(file.id().toString())));
        }
    }

    // =========================================================================
    // Report evidence
    // =========================================================================

    @Nested
    @DisplayName("Report evidence access")
    class ReportEvidenceAccess {

        @Test
        @DisplayName("Only the reporter and administrators can retrieve report evidence")
        void reportEvidenceAuthorization() throws Exception {
            Uploaded file = upload(ownerAlice, aliceToken, UploadPurpose.REPORT);
            MvcResult created = createReport(aliceToken, requesterBob.getId(), List.of(file.id()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.images[0].id", is(file.id().toString())))
                    .andReturn();
            UUID reportId = UUID.fromString(read(created, "id"));

            mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("image/png")));
            mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());

            // Target user, unrelated user, and anonymous callers get no information
            mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id()))
                    .andExpect(status().isUnauthorized());

            // The generic file endpoint never serves private evidence
            mockMvc.perform(get("/api/v1/files/{filename}", file.filename()))
                    .andExpect(status().isNotFound());

            // Images are exposed on reporter and admin report responses
            mockMvc.perform(get("/api/v1/reports/my")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].images[0].id", is(file.id().toString())));
            mockMvc.perform(get("/api/v1/admin/reports/{id}", reportId)
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.images[0].id", is(file.id().toString())));
            mockMvc.perform(get("/api/v1/admin/reports")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].images[0].id", is(file.id().toString())));
        }

        @Test
        @DisplayName("Report evidence is retained after RESOLVED and DISMISSED transitions")
        void reportEvidenceRetainedAcrossStatuses() throws Exception {
            Uploaded file = upload(ownerAlice, aliceToken, UploadPurpose.REPORT);
            MvcResult created = createReport(aliceToken, requesterBob.getId(), List.of(file.id()))
                    .andExpect(status().isCreated())
                    .andReturn();
            UUID reportId = UUID.fromString(read(created, "id"));

            for (String status : List.of("RESOLVED", "DISMISSED")) {
                mockMvc.perform(patch("/api/v1/admin/reports/{id}", reportId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("status", status)))
                                .header(HttpHeaders.AUTHORIZATION, adminToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status", is(status)))
                        .andExpect(jsonPath("$.images[0].id", is(file.id().toString())));

                mockMvc.perform(get("/api/v1/reports/attachments/{fileId}", file.id())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken))
                        .andExpect(status().isOk());
            }

            assertThat(reportAttachmentRepository.findByReportIdOrderByDisplayOrderAsc(reportId)).hasSize(1);
            assertThat(uploadedFileBindingRepository.findByFileId(file.id())).isPresent();
        }
    }

    // =========================================================================
    // Support request attachments
    // =========================================================================

    @Nested
    @DisplayName("Support request attachment access")
    class SupportAttachmentAccess {

        @Test
        @DisplayName("Only the requester and administrators can retrieve support attachments")
        void supportAttachmentAuthorization() throws Exception {
            Uploaded file = upload(ownerAlice, aliceToken, UploadPurpose.SUPPORT);
            MvcResult created = createSupport(aliceToken, List.of(file.id()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.images[0].id", is(file.id().toString())))
                    .andReturn();
            UUID supportRequestId = UUID.fromString(read(created, "id"));

            mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id()))
                    .andExpect(status().isUnauthorized());

            mockMvc.perform(get("/api/v1/files/{filename}", file.filename()))
                    .andExpect(status().isNotFound());

            mockMvc.perform(get("/api/v1/support-requests/my")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].images[0].id", is(file.id().toString())));
            mockMvc.perform(get("/api/v1/admin/support-requests/{id}", supportRequestId)
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.images[0].id", is(file.id().toString())));
            mockMvc.perform(get("/api/v1/admin/support-requests")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].images[0].id", is(file.id().toString())));
        }

        @Test
        @DisplayName("Support attachments are retained across status transitions")
        void supportAttachmentsRetainedAcrossStatuses() throws Exception {
            Uploaded file = upload(ownerAlice, aliceToken, UploadPurpose.SUPPORT);
            MvcResult created = createSupport(aliceToken, List.of(file.id()))
                    .andExpect(status().isCreated())
                    .andReturn();
            UUID supportRequestId = UUID.fromString(read(created, "id"));

            for (String status : List.of("IN_PROGRESS", "RESOLVED", "CLOSED")) {
                mockMvc.perform(patch("/api/v1/admin/support-requests/{id}", supportRequestId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("status", status)))
                                .header(HttpHeaders.AUTHORIZATION, adminToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status", is(status)))
                        .andExpect(jsonPath("$.images[0].id", is(file.id().toString())));

                mockMvc.perform(get("/api/v1/support-requests/attachments/{fileId}", file.id())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken))
                        .andExpect(status().isOk());
            }

            assertThat(supportRequestAttachmentRepository
                    .findBySupportRequestIdOrderByDisplayOrderAsc(supportRequestId)).hasSize(1);
        }
    }

    // =========================================================================
    // Regression: existing upload behavior remains intact
    // =========================================================================

    @Nested
    @DisplayName("Upload regressions")
    class UploadRegressions {

        @Test
        @DisplayName("GENERAL uploads remain publicly retrievable and domain purposes stay private")
        void generalUploadsStayPublicAndDomainUploadsStayPrivate() throws Exception {
            Uploaded general = upload(ownerAlice, aliceToken, UploadPurpose.GENERAL);

            mockMvc.perform(get("/api/v1/files/{filename}", general.filename()))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("image/png")));

            Uploaded reviewPurpose = upload(ownerAlice, aliceToken, UploadPurpose.REVIEW);

            mockMvc.perform(get("/api/v1/files/{filename}", reviewPurpose.filename()))
                    .andExpect(status().isNotFound());
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private record Uploaded(UUID id, String filename) {
    }

    private Transaction createCompletedTransaction() {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                category,
                ListingType.GIVEAWAY,
                "Attachment Test Item " + UUID.randomUUID().toString().substring(0, 6),
                "Item used for attachment integration tests",
                "Ha Noi"
        ));
        listing.setStatus(ListingStatus.COMPLETED);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requesterBob,
                "Please share the item",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request, listing, ownerAlice, requesterBob, TransactionStatus.PENDING);
        transaction.setOwnerCompleted(true);
        transaction.setOwnerCompletedAt(Instant.now());
        transaction.setRequesterCompleted(true);
        transaction.setRequesterCompletedAt(Instant.now());
        transaction.setStatus(TransactionStatus.COMPLETED);
        return transactionRepository.saveAndFlush(transaction);
    }

    private Uploaded upload(User owner, String token, UploadPurpose purpose) throws Exception {
        byte[] png = createValidImage();
        MockMultipartFile file = new MockMultipartFile(
                "file", "attachment-" + UUID.randomUUID() + ".png", "image/png", png);

        String content = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .param("purpose", purpose.name())
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode node = objectMapper.readTree(content);
        UUID id = UUID.fromString(node.get("id").asText());
        String filename = node.get("filename").asText();
        uploadedFilenames.add(filename);
        uploadedFileIds.add(id);
        return new Uploaded(id, filename);
    }

    private byte[] createValidImage() throws IOException {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "png", baos);
        return baos.toByteArray();
    }

    private org.springframework.test.web.servlet.ResultActions createReview(
            String token, UUID transactionId, String comment, List<UUID> imageIds) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rating", 5);
        body.put("comment", comment);
        if (imageIds != null) {
            body.put("imageIds", imageIds);
        }

        return mockMvc.perform(post("/api/v1/transactions/{transactionId}/reviews", transactionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
                .header(HttpHeaders.AUTHORIZATION, token));
    }

    private org.springframework.test.web.servlet.ResultActions createReport(
            String token, UUID targetUserId, List<UUID> imageIds) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("targetType", ReportTargetType.USER.name());
        body.put("targetId", targetUserId);
        body.put("category", ReportCategory.OTHER.name());
        body.put("description", "Suspicious behavior during the exchange");
        body.put("imageIds", imageIds);

        return mockMvc.perform(post("/api/v1/reports")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
                .header(HttpHeaders.AUTHORIZATION, token));
    }

    private org.springframework.test.web.servlet.ResultActions createSupport(
            String token, List<UUID> imageIds) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transactionId", completedTransaction.getId());
        body.put("category", SupportCategory.TRANSACTION_ISSUE.name());
        body.put("subject", "Cannot confirm the handover");
        body.put("description", "Please help resolve this transaction state.");
        body.put("imageIds", imageIds);

        return mockMvc.perform(post("/api/v1/support-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
                .header(HttpHeaders.AUTHORIZATION, token));
    }

    private String read(MvcResult result, String field) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get(field).asText();
    }
}
