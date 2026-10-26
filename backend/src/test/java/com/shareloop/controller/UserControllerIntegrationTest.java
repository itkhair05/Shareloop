package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserControllerIntegrationTest {

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
    private PasswordEncoder passwordEncoder;

    private User userAlice;
    private User userBob;
    private Category testCategory;

    @BeforeEach
    void setUp() {
        userAlice = userRepository.saveAndFlush(new User(
                "Alice Wonder",
                "alice." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        userAlice.setPhoneNumber("+84901234567");
        userAlice = userRepository.saveAndFlush(userAlice);

        userBob = userRepository.saveAndFlush(new User(
                "Bob Builder",
                "bob." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        testCategory = categoryRepository.findBySlug("do-gia-dung")
                .orElseGet(() -> categoryRepository.saveAndFlush(
                        new Category("Đồ gia dụng", "do-gia-dung-" + UUID.randomUUID(), "Đồ dùng trong nhà", true)
                ));
    }

    private Listing createListing(User owner, String title, ListingStatus status) {
        Listing listing = new Listing(
                owner,
                testCategory,
                ListingType.GIVEAWAY,
                title,
                "Mô tả cho " + title,
                "Hồ Chí Minh"
        );
        listing.setStatus(status);
        return listingRepository.saveAndFlush(listing);
    }

    @Nested
    @DisplayName("Public User Profile Tests (GET /api/v1/users/{userId})")
    class PublicProfileTests {

        @Test
        @DisplayName("Valid user returns 200 with approved public fields and no sensitive fields")
        void validUserReturnsPublicFieldsWithoutSensitiveData() throws Exception {
            mockMvc.perform(get("/api/v1/users/{userId}", userAlice.getId())
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(userAlice.getId().toString()))
                    .andExpect(jsonPath("$.displayName").value("Alice Wonder"))
                    .andExpect(jsonPath("$.role").value("USER"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.createdAt").exists())
                    // Verify sensitive fields are strictly excluded
                    .andExpect(jsonPath("$.email").doesNotExist())
                    .andExpect(jsonPath("$.phoneNumber").doesNotExist())
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.password").doesNotExist())
                    .andExpect(jsonPath("$.updatedAt").doesNotExist());
        }

        @Test
        @DisplayName("Public profile is accessible without authentication")
        void publicProfileAccessibleWithoutToken() throws Exception {
            mockMvc.perform(get("/api/v1/users/{userId}", userBob.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayName").value("Bob Builder"));
        }

        @Test
        @DisplayName("Unknown user ID returns 404 Not Found")
        void unknownUserIdReturns404() throws Exception {
            UUID unknownId = UUID.randomUUID();
            mockMvc.perform(get("/api/v1/users/{userId}", unknownId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.message").value(containsString("User not found with id")));
        }

        @Test
        @DisplayName("Malformed UUID parameter returns 400 Bad Request via global exception handler")
        void malformedUuidReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/users/{userId}", "not-a-valid-uuid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.message").value(containsString("could not be converted to expected type")));
        }
    }

    @Nested
    @DisplayName("Public User Active Listings Tests (GET /api/v1/users/{userId}/listings)")
    class UserListingsTests {

        @Test
        @DisplayName("Returns only ACTIVE listings owned by the requested user")
        void returnsOnlyActiveListingsForRequestedUser() throws Exception {
            // Alice has 2 ACTIVE listings and other status listings
            createListing(userAlice, "Alice Active 1", ListingStatus.ACTIVE);
            createListing(userAlice, "Alice Active 2", ListingStatus.ACTIVE);
            createListing(userAlice, "Alice Draft", ListingStatus.DRAFT);
            createListing(userAlice, "Alice Reserved", ListingStatus.RESERVED);
            createListing(userAlice, "Alice Completed", ListingStatus.COMPLETED);
            createListing(userAlice, "Alice Removed", ListingStatus.REMOVED);

            // Bob has 1 ACTIVE listing
            createListing(userBob, "Bob Active 1", ListingStatus.ACTIVE);

            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId())
                            .param("page", "0")
                            .param("size", "10")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.totalElements").value(2))
                    .andExpect(jsonPath("$.content[*].title", containsInAnyOrder("Alice Active 1", "Alice Active 2")))
                    .andExpect(jsonPath("$.content[*].owner.id", everyItem(is(userAlice.getId().toString()))))
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("ACTIVE"))));
        }

        @Test
        @DisplayName("User with no active listings receives an empty page (totalElements = 0)")
        void userWithNoActiveListingsReceivesEmptyPage() throws Exception {
            // Alice only has draft and removed listings
            createListing(userAlice, "Alice Draft", ListingStatus.DRAFT);
            createListing(userAlice, "Alice Removed", ListingStatus.REMOVED);

            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0))
                    .andExpect(jsonPath("$.empty").value(true));
        }

        @Test
        @DisplayName("Public user listings endpoint is accessible without authentication")
        void publicListingsAccessibleWithoutToken() throws Exception {
            createListing(userAlice, "Alice Shared Item", ListingStatus.ACTIVE);

            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].title").value("Alice Shared Item"));
        }

        @Test
        @DisplayName("Unknown user ID returns 404 Not Found")
        void unknownUserIdReturns404ForListings() throws Exception {
            UUID unknownId = UUID.randomUUID();
            mockMvc.perform(get("/api/v1/users/{userId}/listings", unknownId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        }

        @Test
        @DisplayName("Invalid pagination parameters return 400 Bad Request")
        void invalidPaginationParametersReturn400() throws Exception {
            // Page < 0
            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId())
                            .param("page", "-1"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.message").value(containsString("Page index must not be less than zero")));

            // Size <= 0
            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId())
                            .param("size", "0"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));

            // Size > 50
            mockMvc.perform(get("/api/v1/users/{userId}/listings", userAlice.getId())
                            .param("size", "51"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.message").value(containsString("Page size must be between 1 and 50")));
        }

        @Test
        @DisplayName("Malformed UUID parameter returns 400 Bad Request")
        void malformedUuidReturns400ForListings() throws Exception {
            mockMvc.perform(get("/api/v1/users/{userId}/listings", "bad-uuid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
        }
    }
}
