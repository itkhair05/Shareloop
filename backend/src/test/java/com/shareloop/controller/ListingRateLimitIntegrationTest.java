package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.listing.CreateListingRequest;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingCreationEvent;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingCreationEventRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingRateLimitIntegrationTest {

    private static final String RATE_LIMIT_MESSAGE = "Bạn đã đạt giới hạn 10 bài đăng trong 24h. Vui lòng quay lại sau.";

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
    private ListingCreationEventRepository listingCreationEventRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User userAlice;
    private User userBob;
    private User adminUser;
    private String aliceToken;
    private String bobToken;
    private String adminToken;
    private Category category;
    private Category inactiveCategory;

    @BeforeEach
    void setUp() {
        userAlice = userRepository.saveAndFlush(new User(
                "Alice Nguyen",
                "alice.ratelimit." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        userBob = userRepository.saveAndFlush(new User(
                "Bob Tran",
                "bob.ratelimit." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminUser = userRepository.saveAndFlush(new User(
                "Admin RateLimit",
                "admin.ratelimit." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(userAlice.getId(), userAlice.getEmail(), userAlice.getRole(), userAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(userBob.getId(), userBob.getEmail(), userBob.getRole(), userBob.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminUser.getId(), adminUser.getEmail(), adminUser.getRole(), adminUser.getStatus());

        category = categoryRepository.saveAndFlush(new Category(
                "RateLimit Category-" + UUID.randomUUID().toString().substring(0, 8),
                "cat-rl-" + UUID.randomUUID().toString().substring(0, 8),
                "Category for rate limit tests",
                true
        ));

        inactiveCategory = categoryRepository.saveAndFlush(new Category(
                "Inactive Category-" + UUID.randomUUID().toString().substring(0, 8),
                "cat-inact-" + UUID.randomUUID().toString().substring(0, 8),
                "Inactive category for rate limit tests",
                false
        ));
    }

    @AfterEach
    void tearDown() {
        listingCreationEventRepository.deleteAll();
        listingRepository.deleteAll();
        if (category != null && category.getId() != null) {
            categoryRepository.deleteById(category.getId());
        }
        if (inactiveCategory != null && inactiveCategory.getId() != null) {
            categoryRepository.deleteById(inactiveCategory.getId());
        }
        if (userAlice != null && userAlice.getId() != null) {
            userRepository.deleteById(userAlice.getId());
        }
        if (userBob != null && userBob.getId() != null) {
            userRepository.deleteById(userBob.getId());
        }
        if (adminUser != null && adminUser.getId() != null) {
            userRepository.deleteById(adminUser.getId());
        }
    }

    private CreateListingRequest buildValidRequest(String title) {
        return new CreateListingRequest(
                ListingType.GIVEAWAY,
                title,
                "Description for " + title,
                category.getId(),
                "Ha Noi"
        );
    }

    @Test
    @DisplayName("TC 1: User with no recent creation events can create a listing successfully")
    void userWithNoRecentEventsCanCreateListing() throws Exception {
        CreateListingRequest request = buildValidRequest("First Listing");

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("First Listing"));

        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), Instant.now().minus(24, ChronoUnit.HOURS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 2: User with 9 recent events can successfully create the 10th listing")
    void userWithNineEventsCanCreateTenthListing() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 9; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(userAlice, now.minus(i + 1, ChronoUnit.MINUTES)));
        }
        listingCreationEventRepository.flush();

        CreateListingRequest request = buildValidRequest("Tenth Listing");

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Tenth Listing"));

        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), now.minus(24, ChronoUnit.HOURS)))
                .isEqualTo(10);
    }

    @Test
    @DisplayName("TC 3 & 4: 11th creation attempt returns HTTP 429 with exact agreed Vietnamese message")
    void eleventhAttemptReturns429WithVietnameseMessage() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 10; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(userAlice, now.minus(i + 1, ChronoUnit.MINUTES)));
        }
        listingCreationEventRepository.flush();

        CreateListingRequest request = buildValidRequest("Eleventh Listing");

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE))
                .andExpect(jsonPath("$.path").value("/api/v1/listings"));

        // Confirm quota events remain exactly 10
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), now.minus(24, ChronoUnit.HOURS)))
                .isEqualTo(10);
    }

    @Test
    @DisplayName("TC 5: Events older than 24 hours do not consume current rolling quota")
    void eventsOlderThan24HoursDoNotConsumeQuota() throws Exception {
        Instant oldTime = Instant.now().minus(25, ChronoUnit.HOURS);
        for (int i = 0; i < 10; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(userAlice, oldTime.minus(i, ChronoUnit.HOURS)));
        }
        listingCreationEventRepository.flush();

        CreateListingRequest request = buildValidRequest("Listing After Expired Window");

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        // In 24h window, there is now exactly 1 event
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), Instant.now().minus(24, ChronoUnit.HOURS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 6: Deleting a listing does not refund or delete the quota event")
    void deletingListingDoesNotRefundQuota() throws Exception {
        CreateListingRequest request = buildValidRequest("Listing To Delete");

        MvcResult result = mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        String listingIdStr = objectMapper.readTree(responseBody).get("id").asText();
        UUID listingId = UUID.fromString(listingIdStr);

        // Delete the listing
        mockMvc.perform(delete("/api/v1/listings/{id}", listingId)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isNoContent());

        // Confirm listing is deleted
        assertThat(listingRepository.findById(listingId)).isEmpty();

        // Confirm quota event still exists
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), Instant.now().minus(24, ChronoUnit.HOURS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 7: User cannot bypass quota by creating and deleting listings repeatedly")
    void cannotBypassQuotaByCreatingAndDeletingListingsRepeatedly() throws Exception {
        for (int i = 1; i <= 10; i++) {
            CreateListingRequest request = buildValidRequest("Listing " + i);
            MvcResult res = mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andReturn();

            String idStr = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
            UUID id = UUID.fromString(idStr);

            // Delete immediately
            mockMvc.perform(delete("/api/v1/listings/{id}", id)
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isNoContent());
        }

        // Listings table has 0 active listings for Alice
        assertThat(listingRepository.findByOwnerId(userAlice.getId())).isEmpty();

        // But 11th creation attempt MUST still be rejected with 429
        CreateListingRequest eleventhRequest = buildValidRequest("Attempt 11");
        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(eleventhRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 8: Failed listing creation does not consume quota")
    void failedListingCreationDoesNotConsumeQuota() throws Exception {
        // Request with inactive category
        CreateListingRequest invalidCategoryReq = new CreateListingRequest(
                ListingType.GIVEAWAY,
                "Valid Title",
                "Valid Description",
                inactiveCategory.getId(),
                "Ha Noi"
        );

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidCategoryReq)))
                .andExpect(status().isBadRequest());

        // Request with invalid blank title
        CreateListingRequest invalidTitleReq = new CreateListingRequest(
                ListingType.GIVEAWAY,
                "",
                "Valid Description",
                category.getId(),
                "Ha Noi"
        );

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidTitleReq)))
                .andExpect(status().isBadRequest());

        // Quota events must be 0
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), Instant.now().minus(24, ChronoUnit.HOURS)))
                .isZero();
    }

    @Test
    @DisplayName("TC 9: Admin creation is exempt from quota and records no events")
    void adminCreationIsExemptAndRecordsNoEvents() throws Exception {
        Instant now = Instant.now();
        // Insert 10 events for admin user
        for (int i = 0; i < 10; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(adminUser, now.minus(i + 1, ChronoUnit.MINUTES)));
        }
        listingCreationEventRepository.flush();

        CreateListingRequest request = buildValidRequest("Admin Listing");

        // Admin should succeed even with 10 events
        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Admin Listing"));

        // Admin creation must NOT add any new quota event (remains 10)
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(adminUser.getId(), now.minus(24, ChronoUnit.HOURS)))
                .isEqualTo(10);
    }

    @Test
    @DisplayName("TC 10: Independent quotas between users")
    void independentQuotasBetweenUsers() throws Exception {
        Instant now = Instant.now();
        // Alice has 10 events
        for (int i = 0; i < 10; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(userAlice, now.minus(i + 1, ChronoUnit.MINUTES)));
        }
        listingCreationEventRepository.flush();

        // Alice is throttled
        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidRequest("Alice 11th"))))
                .andExpect(status().isTooManyRequests());

        // Bob has 0 events and can create listing
        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidRequest("Bob 1st"))))
                .andExpect(status().isCreated());

        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userBob.getId(), now.minus(24, ChronoUnit.HOURS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 11: Rejected request leaves no listing or quota event behind")
    void rejectedRequestLeavesNoArtifacts() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 10; i++) {
            listingCreationEventRepository.save(new ListingCreationEvent(userAlice, now.minus(i + 1, ChronoUnit.MINUTES)));
        }
        listingCreationEventRepository.flush();

        long listingCountBefore = listingRepository.count();
        long eventCountBefore = listingCreationEventRepository.count();

        mockMvc.perform(post("/api/v1/listings")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidRequest("Should Be Rejected"))))
                .andExpect(status().isTooManyRequests());

        long listingCountAfter = listingRepository.count();
        long eventCountAfter = listingCreationEventRepository.count();

        assertThat(listingCountAfter).isEqualTo(listingCountBefore);
        assertThat(eventCountAfter).isEqualTo(eventCountBefore);
    }

    @Test
    @DisplayName("TC 12: Concurrency test - 15 simultaneous requests result in exactly 10 created and 5 throttled (429)")
    void concurrentCreationRequestsCannotExceedQuota() throws Exception {
        int totalRequests = 15;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger throttledCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final int index = i;
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    CreateListingRequest req = buildValidRequest("Concurrent Listing " + index);
                    String reqBody = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/listings")
                                    .header(HttpHeaders.AUTHORIZATION, aliceToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(reqBody))
                            .andReturn();

                    int statusCode = result.getResponse().getStatus();
                    if (statusCode == 201) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 429) {
                        throttledCount.incrementAndGet();
                    } else {
                        otherCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).as("Unexpected HTTP status codes").isZero();
        assertThat(successCount.get()).as("Exactly 10 requests must succeed").isEqualTo(10);
        assertThat(throttledCount.get()).as("Exactly 5 requests must be throttled with 429").isEqualTo(5);

        // Verify exactly 10 quota events committed in database
        assertThat(listingCreationEventRepository.countByUserIdAndCreatedAtAfter(userAlice.getId(), Instant.now().minus(24, ChronoUnit.HOURS)))
                .isEqualTo(10);

        // Verify exactly 10 listings created
        List<Listing> createdListings = listingRepository.findByOwnerId(userAlice.getId());
        assertThat(createdListings).hasSize(10);
    }
}
