package com.shareloop.controller;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TransactionProofControllerIntegrationTest {

    private static final Pattern TIMESTAMP_PATTERN =
            Pattern.compile("\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2} \\(GMT\\+7\\)");

    @Autowired
    private MockMvc mockMvc;

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
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User ownerAlice;
    private User requesterBob;
    private User outsiderCharlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.proof." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.proof." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        outsiderCharlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.proof." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.proof." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(outsiderCharlie.getId(), outsiderCharlie.getEmail(), outsiderCharlie.getRole(), outsiderCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Proof Category " + UUID.randomUUID().toString().substring(0, 8),
                "proof-slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        if (ownerAlice != null && ownerAlice.getId() != null) {
            listingRepository.findByOwnerId(ownerAlice.getId()).forEach(listingRepository::delete);
        }
        if (generalCategory != null && generalCategory.getId() != null) {
            categoryRepository.deleteById(generalCategory.getId());
        }
        if (ownerAlice != null && ownerAlice.getId() != null) {
            userRepository.deleteById(ownerAlice.getId());
        }
        if (requesterBob != null && requesterBob.getId() != null) {
            userRepository.deleteById(requesterBob.getId());
        }
        if (outsiderCharlie != null && outsiderCharlie.getId() != null) {
            userRepository.deleteById(outsiderCharlie.getId());
        }
        if (adminDave != null && adminDave.getId() != null) {
            userRepository.deleteById(adminDave.getId());
        }
    }

    private Transaction createTestTransaction(ListingStatus listingStatus, TransactionStatus txStatus) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Exchange Desk",
                "Solid oak desk",
                "Hanoi"
        ));
        listing.setStatus(listingStatus);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requesterBob,
                "I would love this desk",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                ownerAlice,
                requesterBob,
                txStatus
        );
        return transactionRepository.saveAndFlush(transaction);
    }

    private Transaction createCompletedTransaction() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk());
        return transactionRepository.findById(tx.getId()).orElseThrow();
    }

    private String extractPdfText(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private void assertProofHeaders(MvcResult result, UUID transactionId) {
        assertThat(result.getResponse().getContentType()).isEqualTo(MediaType.APPLICATION_PDF_VALUE);
        assertThat(result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"shareloop-transaction-proof-" + transactionId + ".pdf\"");
        assertThat(result.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("private, no-store");
        assertThat(result.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(result.getResponse().getContentLength())
                .isEqualTo(result.getResponse().getContentAsByteArray().length);
    }

    @Test
    @DisplayName("Owner can download proof PDF with security headers and valid content")
    void ownerCanDownloadProof() throws Exception {
        Transaction tx = createCompletedTransaction();

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andReturn();

        assertProofHeaders(result, tx.getId());
        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(new String(body, 0, 5)).isEqualTo("%PDF-");

        String text = extractPdfText(body);
        assertThat(text).contains(tx.getId().toString());
        assertThat(text).contains(tx.getListing().getId().toString());
        assertThat(text).contains("Alice Owner");
        assertThat(text).contains("Bob Requester");
        assertThat(text).contains("Exchange Desk");
        assertThat(text).contains("GIVEAWAY");
        assertThat(text).contains(generalCategory.getName());
        assertThat(text).contains("Đã hoàn tất");
        assertThat(text).contains("Trang 1/1");
        assertThat(text).contains("không phải hợp đồng pháp lý");
        assertThat(TIMESTAMP_PATTERN.matcher(text).results().count()).isGreaterThanOrEqualTo(5L);
    }

    @Test
    @DisplayName("Requester can download proof PDF")
    void requesterCanDownloadProof() throws Exception {
        Transaction tx = createCompletedTransaction();

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andReturn();

        assertProofHeaders(result, tx.getId());
        assertThat(new String(result.getResponse().getContentAsByteArray(), 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("Admin can download proof PDF")
    void adminCanDownloadProof() throws Exception {
        Transaction tx = createCompletedTransaction();

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andReturn();

        assertProofHeaders(result, tx.getId());
    }

    @Test
    @DisplayName("Unrelated authenticated user receives 403")
    void outsiderReceives403() throws Exception {
        Transaction tx = createCompletedTransaction();

        mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated request receives 401")
    void unauthenticatedReceives401() throws Exception {
        Transaction tx = createCompletedTransaction();

        mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Unknown transaction UUID receives 404")
    void unknownTransactionReceives404() throws Exception {
        mockMvc.perform(get("/api/v1/transactions/{id}/proof", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PENDING transaction receives 409 with Vietnamese message")
    void pendingTransactionReceives409() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Giao dịch chưa hoàn tất nên chưa thể tải tài liệu xác nhận."));
    }

    @Test
    @DisplayName("IN_PROGRESS transaction receives 409")
    void inProgressTransactionReceives409() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    @DisplayName("CANCELLED transaction receives 409")
    void cancelledTransactionReceives409() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    @DisplayName("Proof PDF excludes email, phone, city, price, and other excluded data")
    void proofPdfExcludesSensitiveAndExcludedData() throws Exception {
        Transaction tx = createCompletedTransaction();

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andReturn();

        String text = extractPdfText(result.getResponse().getContentAsByteArray());
        assertThat(text).doesNotContain(ownerAlice.getEmail());
        assertThat(text).doesNotContain(requesterBob.getEmail());
        assertThat(text).doesNotContain("Hanoi");
        assertThat(text).doesNotContain("Password123!");
        assertThat(text).doesNotContain("http://");
        assertThat(text).doesNotContain("https://");
    }

    @Test
    @DisplayName("REMOVED listing still permits proof generation for a completed transaction")
    void removedListingStillPermitsProof() throws Exception {
        Transaction tx = createCompletedTransaction();

        Listing listing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        listing.setStatus(ListingStatus.REMOVED);
        listingRepository.saveAndFlush(listing);

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andReturn();

        assertProofHeaders(result, tx.getId());
        String text = extractPdfText(result.getResponse().getContentAsByteArray());
        assertThat(text).contains("Exchange Desk");
    }

    @Test
    @DisplayName("JSON error responses remain understandable when the client requests a PDF")
    void pdfRequestStillReturnsJsonErrors() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        MvcResult result = mockMvc.perform(get("/api/v1/transactions/{id}/proof", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .header(HttpHeaders.ACCEPT, "application/pdf, application/json"))
                .andExpect(status().isConflict())
                .andReturn();

        assertThat(result.getResponse().getContentType()).contains(MediaType.APPLICATION_JSON_VALUE);
        assertThat(result.getResponse().getContentAsString()).contains("chưa hoàn tất");
    }
}
