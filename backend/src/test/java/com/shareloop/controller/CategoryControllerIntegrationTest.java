package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.category.CreateCategoryRequest;
import com.shareloop.dto.category.UpdateCategoryRequest;
import com.shareloop.dto.category.UpdateCategoryStatusRequest;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CategoryControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    private User regularUser;
    private User adminUser;
    private String userToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        regularUser = userRepository.saveAndFlush(new User(
                "Regular User",
                "regular." + UUID.randomUUID() + "@example.com",
                "hash_123456",
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        userToken = "Bearer " + jwtService.generateToken(
                regularUser.getId(),
                regularUser.getEmail(),
                regularUser.getRole(),
                regularUser.getStatus()
        );

        adminUser = userRepository.saveAndFlush(new User(
                "Admin User",
                "admin." + UUID.randomUUID() + "@example.com",
                "hash_123456",
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));
        adminToken = "Bearer " + jwtService.generateToken(
                adminUser.getId(),
                adminUser.getEmail(),
                adminUser.getRole(),
                adminUser.getStatus()
        );
    }

    @Nested
    @DisplayName("Public Categories API")
    class PublicCategoriesTests {

        @Test
        @DisplayName("GET /api/v1/categories - Returns active categories ordered alphabetically without authentication")
        void getActiveCategoriesPublicly() throws Exception {
            mockMvc.perform(get("/api/v1/categories")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", isA(java.util.List.class)))
                    .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(9)))
                    .andExpect(jsonPath("$[*].slug", hasItem("tools-diy")))
                    .andExpect(jsonPath("$[*].slug", hasItem("electronics-appliances")))
                    .andExpect(jsonPath("$[*].isActive", everyItem(is(true))));
        }

        @Test
        @DisplayName("GET /api/v1/categories - Excludes deactivated categories")
        void excludesDeactivatedCategories() throws Exception {
            Category inactiveCat = categoryRepository.saveAndFlush(new Category(
                    "Antique Relics",
                    "antique-relics-" + UUID.randomUUID().toString().substring(0, 8),
                    "Deactivated category",
                    false
            ));

            mockMvc.perform(get("/api/v1/categories")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id", not(hasItem(inactiveCat.getId().toString()))));
        }

        @Test
        @DisplayName("GET /api/v1/categories/{slug} - Returns category details and active listing count")
        void getCategoryBySlugWithListingCount() throws Exception {
            Category cat = categoryRepository.findBySlug("tools-diy").orElseThrow();
            long initialCount = listingRepository.countByCategoryIdAndStatus(cat.getId(), ListingStatus.ACTIVE);

            // Create 2 ACTIVE listings and 1 COMPLETED listing under this category
            createListing(cat, ListingStatus.ACTIVE, "Drill Machine");
            createListing(cat, ListingStatus.ACTIVE, "Hammer Set");
            createListing(cat, ListingStatus.COMPLETED, "Sold Chainsaw");

            mockMvc.perform(get("/api/v1/categories/{slug}", "tools-diy")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.slug").value("tools-diy"))
                    .andExpect(jsonPath("$.name").value("Dụng cụ & Đồ sửa chữa"))
                    .andExpect(jsonPath("$.isActive").value(true))
                    .andExpect(jsonPath("$.activeListingCount").value((int) initialCount + 2));
        }

        @Test
        @DisplayName("GET /api/v1/categories/{slug} - Case-insensitive and trimmed slug normalization")
        void getCategoryBySlugNormalization() throws Exception {
            mockMvc.perform(get("/api/v1/categories/{slug}", "  TOOLS-DIY  ")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.slug").value("tools-diy"));
        }

        @Test
        @DisplayName("GET /api/v1/categories/{slug} - Unknown slug returns 404 NOT_FOUND")
        void getCategoryUnknownSlugReturns404() throws Exception {
            mockMvc.perform(get("/api/v1/categories/{slug}", "non-existent-slug-xyz")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.error").value("Not Found"));
        }

        @Test
        @DisplayName("GET /api/v1/categories/{slug} - Deactivated category returns 404 NOT_FOUND for public")
        void getDeactivatedCategoryReturns404() throws Exception {
            String slug = "secret-vault-" + UUID.randomUUID().toString().substring(0, 8);
            categoryRepository.saveAndFlush(new Category(
                    "Secret Vault",
                    slug,
                    "Hidden",
                    false
            ));

            mockMvc.perform(get("/api/v1/categories/{slug}", slug)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    @Nested
    @DisplayName("Admin Categories API - Authorization Guards")
    class AdminAuthorizationTests {

        @Test
        @DisplayName("GET /api/v1/admin/categories - Anonymous request returns 401 Unauthorized")
        void getAllCategoriesAnonymousReturns401() throws Exception {
            mockMvc.perform(get("/api/v1/admin/categories")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("GET /api/v1/admin/categories - Regular USER role returns 403 Forbidden")
        void getAllCategoriesRegularUserReturns403() throws Exception {
            mockMvc.perform(get("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, userToken)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("POST /api/v1/admin/categories - Anonymous request returns 401 Unauthorized")
        void createCategoryAnonymousReturns401() throws Exception {
            CreateCategoryRequest req = new CreateCategoryRequest("Garden Tools", "garden-tools", "Desc", true);

            mockMvc.perform(post("/api/v1/admin/categories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("POST /api/v1/admin/categories - Regular USER role returns 403 Forbidden")
        void createCategoryRegularUserReturns403() throws Exception {
            CreateCategoryRequest req = new CreateCategoryRequest("Garden Tools", "garden-tools", "Desc", true);

            mockMvc.perform(post("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, userToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("PUT /api/v1/admin/categories/{id} - Regular USER returns 403 Forbidden")
        void updateCategoryRegularUserReturns403() throws Exception {
            Category cat = categoryRepository.findBySlug("tools-diy").orElseThrow();
            UpdateCategoryRequest req = new UpdateCategoryRequest("Updated Tools", "tools-diy", "Updated", true);

            mockMvc.perform(put("/api/v1/admin/categories/{id}", cat.getId())
                            .header(HttpHeaders.AUTHORIZATION, userToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("PATCH /api/v1/admin/categories/{id}/status - Regular USER returns 403 Forbidden")
        void updateCategoryStatusRegularUserReturns403() throws Exception {
            Category cat = categoryRepository.findBySlug("tools-diy").orElseThrow();
            UpdateCategoryStatusRequest req = new UpdateCategoryStatusRequest(false);

            mockMvc.perform(patch("/api/v1/admin/categories/{id}/status", cat.getId())
                            .header(HttpHeaders.AUTHORIZATION, userToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("Admin Categories API - Operations")
    class AdminOperationsTests {

        @Test
        @DisplayName("POST /api/v1/admin/categories - Admin successfully creates a new category")
        void adminCreatesCategorySuccessfully() throws Exception {
            String slug = "musical-instruments-" + UUID.randomUUID().toString().substring(0, 8);
            CreateCategoryRequest req = new CreateCategoryRequest(
                    "Musical Instruments",
                    slug,
                    "Guitars, keyboards, drums, and music gear",
                    true
            );

            mockMvc.perform(post("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNotEmpty())
                    .andExpect(jsonPath("$.name").value("Musical Instruments"))
                    .andExpect(jsonPath("$.slug").value(slug))
                    .andExpect(jsonPath("$.isActive").value(true));

            assertThat(categoryRepository.existsBySlug(slug)).isTrue();
        }

        @Test
        @DisplayName("POST /api/v1/admin/categories - Rejects duplicate slug with 409 Conflict")
        void adminCreateCategoryDuplicateSlugReturns409() throws Exception {
            CreateCategoryRequest req = new CreateCategoryRequest(
                    "Duplicate Tools",
                    "tools-diy", // Existing slug from V5
                    "Attempting duplicate",
                    true
            );

            mockMvc.perform(post("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.message").value(containsString("already exists")));
        }

        @Test
        @DisplayName("POST /api/v1/admin/categories - Rejects invalid slug pattern with 400 Bad Request")
        void adminCreateCategoryInvalidSlugReturns400() throws Exception {
            CreateCategoryRequest req = new CreateCategoryRequest(
                    "Invalid Slug",
                    "Invalid_Slug!@#",
                    "Desc",
                    true
            );

            mockMvc.perform(post("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
        }

        @Test
        @DisplayName("PUT /api/v1/admin/categories/{id} - Admin successfully updates category")
        void adminUpdatesCategorySuccessfully() throws Exception {
            String originalSlug = "orig-slug-" + UUID.randomUUID().toString().substring(0, 8);
            Category cat = categoryRepository.saveAndFlush(new Category(
                    "Original Name",
                    originalSlug,
                    "Original Desc",
                    true
            ));

            String newSlug = "updated-slug-" + UUID.randomUUID().toString().substring(0, 8);
            UpdateCategoryRequest updateReq = new UpdateCategoryRequest(
                    "Renamed Category",
                    newSlug,
                    "Updated Description",
                    true
            );

            mockMvc.perform(put("/api/v1/admin/categories/{id}", cat.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(cat.getId().toString()))
                    .andExpect(jsonPath("$.name").value("Renamed Category"))
                    .andExpect(jsonPath("$.slug").value(newSlug))
                    .andExpect(jsonPath("$.description").value("Updated Description"));

            Category updatedInDb = categoryRepository.findById(cat.getId()).orElseThrow();
            assertThat(updatedInDb.getName()).isEqualTo("Renamed Category");
            assertThat(updatedInDb.getSlug()).isEqualTo(newSlug);
        }

        @Test
        @DisplayName("PATCH /api/v1/admin/categories/{id}/status - Deactivates category while preserving existing listings")
        void adminDeactivatesCategoryPreservingListings() throws Exception {
            Category cat = categoryRepository.findBySlug("sports-outdoors").orElseThrow();
            Listing listing = createListing(cat, ListingStatus.ACTIVE, "Mountain Bike");

            UpdateCategoryStatusRequest req = new UpdateCategoryStatusRequest(false);

            mockMvc.perform(patch("/api/v1/admin/categories/{id}/status", cat.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isActive").value(false));

            // Verify in DB
            Category updatedCat = categoryRepository.findById(cat.getId()).orElseThrow();
            assertThat(updatedCat.getIsActive()).isFalse();

            // Verify existing listing remains intact and references the category
            Listing reloadedListing = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(reloadedListing.getCategory().getId()).isEqualTo(cat.getId());
            assertThat(reloadedListing.getStatus()).isEqualTo(ListingStatus.ACTIVE);
        }

        @Test
        @DisplayName("GET /api/v1/admin/categories - Admin retrieves active and inactive categories with activeListingCount")
        void adminRetrievesAllCategoriesIncludingInactiveWithListingCounts() throws Exception {
            // Create an inactive category with no listings
            String inactiveSlug = "vintage-relics-" + UUID.randomUUID().toString().substring(0, 8);
            Category inactiveCat = categoryRepository.saveAndFlush(new Category(
                    "Vintage Relics",
                    inactiveSlug,
                    "Historic collectibles",
                    false
            ));

            // Setup active listing count for tools-diy
            Category toolsCat = categoryRepository.findBySlug("tools-diy").orElseThrow();
            long initialToolsCount = listingRepository.countByCategoryIdAndStatus(toolsCat.getId(), ListingStatus.ACTIVE);

            // Add 2 ACTIVE and 1 COMPLETED listings to tools-diy
            createListing(toolsCat, ListingStatus.ACTIVE, "Cordless Drill");
            createListing(toolsCat, ListingStatus.ACTIVE, "Wrench Set");
            createListing(toolsCat, ListingStatus.COMPLETED, "Sold Circular Saw");

            mockMvc.perform(get("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", isA(java.util.List.class)))
                    // Verify inactive category is present with 0 active listings
                    .andExpect(jsonPath("$[?(@.slug == '" + inactiveSlug + "')].isActive").value(hasItem(false)))
                    .andExpect(jsonPath("$[?(@.slug == '" + inactiveSlug + "')].activeListingCount").value(hasItem(0)))
                    // Verify tools-diy has correct activeListingCount (initial + 2)
                    .andExpect(jsonPath("$[?(@.slug == 'tools-diy')].activeListingCount").value(hasItem((int) initialToolsCount + 2)))
                    // Verify active category is present with isActive = true
                    .andExpect(jsonPath("$[?(@.slug == 'tools-diy')].isActive").value(hasItem(true)));

            // Verify public endpoint still excludes the inactive category
            mockMvc.perform(get("/api/v1/categories")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].slug", not(hasItem(inactiveSlug))));
        }

        @Test
        @DisplayName("GET /api/v1/admin/categories - Categories are ordered by name ascending")
        void adminCategoriesAreOrderedByNameAscending() throws Exception {
            var mvcResult = mockMvc.perform(get("/api/v1/admin/categories")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();

            String json = mvcResult.getResponse().getContentAsString();
            var jsonNode = objectMapper.readTree(json);
            java.util.List<String> names = new java.util.ArrayList<>();
            for (var node : jsonNode) {
                names.add(node.get("name").asText());
            }

            assertThat(names).isNotEmpty();
            java.util.List<String> sortedNames = new java.util.ArrayList<>(names);
            sortedNames.sort(String::compareTo);
            assertThat(names).isEqualTo(sortedNames);
        }
    }

    private Listing createListing(Category category, ListingStatus status, String title) {
        Listing listing = new Listing(
                regularUser,
                category,
                ListingType.GIVEAWAY,
                title,
                "Description for " + title,
                "Ho Chi Minh City"
        );
        listing.setStatus(status);
        return listingRepository.saveAndFlush(listing);
    }
}
