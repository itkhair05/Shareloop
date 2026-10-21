package com.shareloop.controller;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
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
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User regularUser;
    private String regularUserToken;

    @BeforeEach
    void setUp() {
        regularUser = userRepository.saveAndFlush(new User(
                "Regular User",
                "regular." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        regularUserToken = "Bearer " + jwtService.generateToken(
                regularUser.getId(),
                regularUser.getEmail(),
                regularUser.getRole(),
                regularUser.getStatus()
        );
    }

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    // =========================================================================
    // 1. OpenAPI 3 Specification Endpoint Verification
    // =========================================================================

    @Test
    @DisplayName("GET /v3/api-docs returns valid OpenAPI 3 specification")
    void getApiDocs_returnsValidOpenApiSpec() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.openapi", startsWith("3.")))
                .andExpect(jsonPath("$.info.title", is("ShareLoop REST API")))
                .andExpect(jsonPath("$.info.version", is("1.0.0")))
                .andExpect(jsonPath("$.info.description", notNullValue()))
                // Verify JWT Bearer Security Scheme
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type", is("http")))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme", is("bearer")))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat", is("JWT")))
                // Verify core paths are registered
                .andExpect(jsonPath("$.paths['/api/v1/auth/register']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/auth/login']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/auth/me']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/categories']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/listings']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/listings/mine']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/notifications']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/files/upload']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/files/{filename}']", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/health']", notNullValue()))
                // Verify tags are registered
                .andExpect(jsonPath("$.tags[*].name", hasItems(
                        "Authentication", "Categories", "Listings", "Listing Requests",
                        "Chat", "Transactions", "Reviews", "Notifications", "File Storage", "Health & Monitoring"
                )));
    }

    @Test
    @DisplayName("OpenAPI spec does not leak internal secrets or database credentials")
    void getApiDocs_doesNotLeakSecrets() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("shareloop_password"))))
                .andExpect(content().string(not(containsString("shareloop-test-secret"))));
    }

    @Test
    @DisplayName("OpenAPI specification accurately distinguishes public from JWT-protected endpoints")
    void getApiDocs_accuratelyDistinguishesPublicFromProtectedEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                // Root level security requirement must be absent so public endpoints are unauthenticated
                .andExpect(jsonPath("$.security").doesNotExist())
                // Public endpoints must have NO security requirement
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/auth/register'].post.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/health'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/categories'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/categories/{slug}'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/listings'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/listings/{id}'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/files/{filename}'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/users/{userId}/reviews'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/users/{userId}/rating-summary'].get.security").doesNotExist())
                // Protected endpoints must declare bearerAuth security requirement
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].get.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/listings/mine'].get.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/listings'].post.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/files/upload'].post.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/notifications'].get.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/conversations'].get.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/transactions'].get.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/listing-requests/mine'].get.security[0].bearerAuth", notNullValue()))
                // Admin endpoints must declare bearerAuth security requirement
                .andExpect(jsonPath("$.paths['/api/v1/admin/categories'].post.security[0].bearerAuth", notNullValue()))
                .andExpect(jsonPath("$.paths['/api/v1/admin/reviews/{reviewId}'].delete.security[0].bearerAuth", notNullValue()));
    }

    // =========================================================================
    // 2. Swagger UI Availability Verification
    // =========================================================================

    @Test
    @DisplayName("GET /swagger-ui.html redirects to or serves Swagger UI")
    void getSwaggerUiHtml_isAccessible() throws Exception {
        mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string(HttpHeaders.LOCATION, containsString("swagger-ui/index.html")));
    }

    @Test
    @DisplayName("GET /swagger-ui/index.html loads Swagger UI resources")
    void getSwaggerUiIndex_isAccessible() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    // =========================================================================
    // 3. Security Boundary and Role Enforcement Verification
    // =========================================================================

    @Test
    @DisplayName("Anonymous access to protected endpoints remains blocked with 401")
    void protectedEndpoints_anonymousBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/listings/mine"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/files/upload"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Admin role restriction remains strictly enforced with 403 Forbidden")
    void adminEndpoints_nonAdminBlockedWith403() throws Exception {
        // Regular user attempting admin operation
        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test Category\"}")
                        .header(HttpHeaders.AUTHORIZATION, regularUserToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Public endpoints remain publicly accessible without token")
    void publicEndpoints_remainAccessible() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));

        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk());
    }
}
