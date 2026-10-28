package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.request.CreateListingRequestDto;
import com.shareloop.dto.request.UpdateListingRequestStatusRequest;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class ListingRequestControllerIntegrationTest {

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
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User ownerAlice;
    private User requesterBob;
    private User otherCharlie;
    private User adminUser;
    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        otherCharlie = userRepository.saveAndFlush(new User(
                "Charlie Other",
                "charlie." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminUser = userRepository.saveAndFlush(new User(
                "Admin Moderation",
                "admin." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(otherCharlie.getId(), otherCharlie.getEmail(), otherCharlie.getRole(), otherCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminUser.getId(), adminUser.getEmail(), adminUser.getRole(), adminUser.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    private Listing createListing(User owner, ListingType type, ListingStatus status, String title) {
        Listing listing = new Listing(owner, generalCategory, type, title, "Description for " + title, "Ha Noi");
        listing.setStatus(status);
        if (type == ListingType.SALE) {
            listing.setPrice(new BigDecimal("200000.00"));
            listing.setCurrency("VND");
        } else if (type == ListingType.WANTED) {
            listing.setPrice(new BigDecimal("100000.00"));
            listing.setCurrency("VND");
        }
        return listingRepository.saveAndFlush(listing);
    }

    @Nested
    @DisplayName("Submit Listing Request Tests")
    class SubmitRequestTests {

        @Test
        @DisplayName("Successfully submit request for GIVEAWAY listing")
        void submitRequestForGiveawaySuccess() throws Exception {
            Listing giveaway = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Free Couch");
            CreateListingRequestDto dto = new CreateListingRequestDto("I would love to pick this up this Saturday!");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", giveaway.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(dto)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.listing.id").value(giveaway.getId().toString()))
                    .andExpect(jsonPath("$.listing.title").value("Free Couch"))
                    .andExpect(jsonPath("$.requester.id").value(requesterBob.getId().toString()))
                    .andExpect(jsonPath("$.requester.displayName").value("Bob Requester"))
                    .andExpect(jsonPath("$.message").value("I would love to pick this up this Saturday!"))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.createdAt").exists());

            assertThat(listingRequestRepository.existsByListingIdAndRequesterIdAndStatus(
                    giveaway.getId(), requesterBob.getId(), ListingRequestStatus.PENDING)).isTrue();
        }

        @Test
        @DisplayName("Successfully submit request for SALE listing without message")
        void submitRequestForSaleWithoutMessageSuccess() throws Exception {
            Listing sale = createListing(ownerAlice, ListingType.SALE, ListingStatus.ACTIVE, "Bicycle");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", sale.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.listing.id").value(sale.getId().toString()))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.message").doesNotExist());
        }

        @Test
        @DisplayName("Reject request from unauthenticated client with 401 Unauthorized")
        void rejectUnauthenticatedRequest() throws Exception {
            Listing giveaway = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Free Desk");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", giveaway.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Reject self-request (owner requesting their own listing) with 400 Bad Request")
        void rejectSelfRequest() throws Exception {
            Listing giveaway = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Alice's Item");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", giveaway.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Users cannot request their own listings")));
        }

        @Test
        @DisplayName("Reject request for WANTED listing with 400 Bad Request")
        void rejectRequestForWantedListing() throws Exception {
            Listing wanted = createListing(ownerAlice, ListingType.WANTED, ListingStatus.ACTIVE, "Seeking Monitor");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", wanted.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Requests can only be submitted for GIVEAWAY or SALE listings")));
        }

        @Test
        @DisplayName("Reject request for non-active listing (DRAFT, RESERVED, COMPLETED, REMOVED)")
        void rejectRequestForNonActiveListing() throws Exception {
            Listing reserved = createListing(ownerAlice, ListingType.SALE, ListingStatus.RESERVED, "Reserved Phone");

            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", reserved.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Listing is not active and cannot receive requests")));
        }

        @Test
        @DisplayName("Reject duplicate active pending request from the same user with 409 Conflict")
        void rejectDuplicatePendingRequest() throws Exception {
            Listing giveaway = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Free Table");

            // First request succeeds
            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", giveaway.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isCreated());

            // Second request from same user while first is PENDING returns 409 Conflict
            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", giveaway.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value(containsString("already have an active pending request")));
        }

        @Test
        @DisplayName("Return 404 for non-existent listing ID")
        void return404ForNonExistentListing() throws Exception {
            mockMvc.perform(post("/api/v1/listings/{listingId}/requests", UUID.randomUUID())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("View Requests for Listing (Owner View) Tests")
    class ViewRequestsForListingTests {

        @Test
        @DisplayName("Listing owner can view requests with pagination and deterministic sorting")
        void ownerCanViewRequestsWithPaginationAndSorting() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Guitar");

            ListingRequest r1 = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Bob message", ListingRequestStatus.PENDING));
            ListingRequest r2 = listingRequestRepository.saveAndFlush(new ListingRequest(listing, otherCharlie, "Charlie message", ListingRequestStatus.PENDING));

            mockMvc.perform(get("/api/v1/listings/{listingId}/requests", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.content[0].id").value(r2.getId().toString()))
                    .andExpect(jsonPath("$.content[1].id").value(r1.getId().toString()));
        }

        @Test
        @DisplayName("Reject non-owner user attempting to view requests with 403 Forbidden")
        void rejectNonOwnerViewingRequests() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Private Requests Item");

            mockMvc.perform(get("/api/v1/listings/{listingId}/requests", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("Only the listing owner may view requests")));
        }

        @Test
        @DisplayName("Admin can view requests for any listing")
        void adminCanViewRequestsForAnyListing() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Moderated Item");
            listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Bob msg", ListingRequestStatus.PENDING));

            mockMvc.perform(get("/api/v1/listings/{listingId}/requests", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)));
        }

        @Test
        @DisplayName("Filter requests by status on listing owner endpoint")
        void filterRequestsByStatus() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item with Multiple Requests");

            ListingRequest pending = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Pending", ListingRequestStatus.PENDING));
            ListingRequest rejected = listingRequestRepository.saveAndFlush(new ListingRequest(listing, otherCharlie, "Rejected", ListingRequestStatus.REJECTED));

            mockMvc.perform(get("/api/v1/listings/{listingId}/requests", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .param("status", "REJECTED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id").value(rejected.getId().toString()));
        }
    }

    @Nested
    @DisplayName("User Personal Requests (/mine) Tests")
    class MyRequestsTests {

        @Test
        @DisplayName("User views only their own submitted requests")
        void userViewsOnlyTheirOwnRequests() throws Exception {
            Listing l1 = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Listing 1");
            Listing l2 = createListing(ownerAlice, ListingType.SALE, ListingStatus.ACTIVE, "Listing 2");

            ListingRequest bobReq = listingRequestRepository.saveAndFlush(new ListingRequest(l1, requesterBob, "Bob req", ListingRequestStatus.PENDING));
            ListingRequest charlieReq = listingRequestRepository.saveAndFlush(new ListingRequest(l2, otherCharlie, "Charlie req", ListingRequestStatus.PENDING));

            mockMvc.perform(get("/api/v1/listing-requests/mine")
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id").value(bobReq.getId().toString()))
                    .andExpect(jsonPath("$.content[0].requester.id").value(requesterBob.getId().toString()));
        }

        @Test
        @DisplayName("Reject unauthenticated access to /mine with 401 Unauthorized")
        void rejectUnauthenticatedMine() throws Exception {
            mockMvc.perform(get("/api/v1/listing-requests/mine"))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("Update Request Status (Accept / Reject) Tests")
    class UpdateRequestStatusTests {

        @Test
        @DisplayName("Owner successfully ACCEPTS pending request: transitions request to ACCEPTED, creates transaction, sets listing RESERVED")
        void ownerAcceptsRequestSuccess() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Piano");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "I want the piano", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest updateDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);

            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(request.getId().toString()))
                    .andExpect(jsonPath("$.status").value("ACCEPTED"));

            // 1. Verify request is ACCEPTED
            ListingRequest updatedReq = listingRequestRepository.findById(request.getId()).orElseThrow();
            assertThat(updatedReq.getStatus()).isEqualTo(ListingRequestStatus.ACCEPTED);

            // 2. Verify Transaction was created in PENDING status
            Optional<Transaction> txOpt = transactionRepository.findByListingRequestId(request.getId());
            assertThat(txOpt).isPresent();
            Transaction tx = txOpt.get();
            assertThat(tx.getListing().getId()).isEqualTo(listing.getId());
            assertThat(tx.getOwner().getId()).isEqualTo(ownerAlice.getId());
            assertThat(tx.getRequester().getId()).isEqualTo(requesterBob.getId());
            assertThat(tx.getStatus()).isEqualTo(TransactionStatus.PENDING);

            // 3. Verify Listing is now RESERVED
            Listing updatedListing = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(updatedListing.getStatus()).isEqualTo(ListingStatus.RESERVED);
        }

        @Test
        @DisplayName("Owner successfully REJECTS pending request: transitions request to REJECTED, listing remains ACTIVE, no transaction")
        void ownerRejectsRequestSuccess() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.SALE, ListingStatus.ACTIVE, "Camera");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Lowball offer", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest updateDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.REJECTED);

            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REJECTED"));

            ListingRequest updatedReq = listingRequestRepository.findById(request.getId()).orElseThrow();
            assertThat(updatedReq.getStatus()).isEqualTo(ListingRequestStatus.REJECTED);

            // No transaction created
            assertThat(transactionRepository.findByListingRequestId(request.getId())).isEmpty();

            // Listing remains ACTIVE
            Listing updatedListing = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(updatedListing.getStatus()).isEqualTo(ListingStatus.ACTIVE);
        }

        @Test
        @DisplayName("Reject non-owner user attempting to accept or reject request with 403 Forbidden")
        void rejectNonOwnerAcceptingRequest() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Microwave");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "I want it", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest updateDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);

            // Bob (requester) cannot accept his own request
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isForbidden());

            // Charlie (unrelated) cannot accept Alice's request
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Reject invalid status transition (attempting to set CANCELLED or PENDING) with 400 Bad Request")
        void rejectInvalidTargetStatus() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Msg", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest updateDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.CANCELLED);

            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Only ACCEPTED or REJECTED status transitions are allowed")));
        }

        @Test
        @DisplayName("Reject transition when request is already ACCEPTED or REJECTED")
        void rejectTransitionOnNonPendingRequest() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Msg", ListingRequestStatus.REJECTED));

            UpdateListingRequestStatusRequest updateDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);

            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateDto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Only PENDING requests can be accepted or rejected")));
        }

        @Test
        @DisplayName("Reject accepting request when listing is already RESERVED or has an active transaction")
        void rejectAcceptingWhenListingAlreadyReserved() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item with Multiple Contenders");

            ListingRequest req1 = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Bob first", ListingRequestStatus.PENDING));
            ListingRequest req2 = listingRequestRepository.saveAndFlush(new ListingRequest(listing, otherCharlie, "Charlie second", ListingRequestStatus.PENDING));

            // Owner accepts Bob's request -> listing becomes RESERVED, tx created
            UpdateListingRequestStatusRequest acceptDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", req1.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(acceptDto)))
                    .andExpect(status().isOk());

            // Owner attempts to also accept Charlie's request -> rejected
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", req2.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(acceptDto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Cannot accept request: listing is currently RESERVED")));
        }

        @Test
        @DisplayName("Admin can accept pending request on any listing")
        void adminCanAcceptPendingRequest() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Admin Accepted Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Want this", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest acceptDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(acceptDto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ACCEPTED"));

            ListingRequest updatedReq = listingRequestRepository.findById(request.getId()).orElseThrow();
            assertThat(updatedReq.getStatus()).isEqualTo(ListingRequestStatus.ACCEPTED);

            Listing updatedListing = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(updatedListing.getStatus()).isEqualTo(ListingStatus.RESERVED);

            assertThat(transactionRepository.findByListingRequestId(request.getId())).isPresent();
        }

        @Test
        @DisplayName("Admin can reject pending request on any listing")
        void adminCanRejectPendingRequest() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Admin Rejected Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Want this", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest rejectDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.REJECTED);
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(rejectDto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REJECTED"));

            ListingRequest updatedReq = listingRequestRepository.findById(request.getId()).orElseThrow();
            assertThat(updatedReq.getStatus()).isEqualTo(ListingRequestStatus.REJECTED);

            Listing updatedListing = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(updatedListing.getStatus()).isEqualTo(ListingStatus.ACTIVE);

            assertThat(transactionRepository.findByListingRequestId(request.getId())).isEmpty();
        }

        @Test
        @DisplayName("Reject accepting request when listing is COMPLETED")
        void rejectAcceptingWhenListingIsCompleted() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.COMPLETED, "Completed Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Want this", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest acceptDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(acceptDto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Cannot accept request: listing is currently COMPLETED")));
        }

        @Test
        @DisplayName("Reject accepting request when listing is REMOVED")
        void rejectAcceptingWhenListingIsRemoved() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.REMOVED, "Removed Item");
            ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(listing, requesterBob, "Want this", ListingRequestStatus.PENDING));

            UpdateListingRequestStatusRequest acceptDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);
            mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", request.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(acceptDto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Cannot accept request: listing is currently REMOVED")));
        }
    }
}
