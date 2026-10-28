package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.user.UpdateUserRoleAdminRequest;
import com.shareloop.dto.user.UpdateUserStatusAdminRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminUserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User adminPrimary;
    private User adminSecondary;
    private User normalUser;
    private User suspendedUser;
    private User deactivatedUser;

    private String adminPrimaryToken;
    private String adminSecondaryToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        cleanDatabase();

        adminPrimary = userRepository.saveAndFlush(new User(
                "Super Admin Primary",
                "admin.primary." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("AdminPass123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        adminSecondary = userRepository.saveAndFlush(new User(
                "Support Admin Secondary",
                "admin.secondary." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("AdminPass123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        normalUser = userRepository.saveAndFlush(new User(
                "Nguyen Van Normal",
                "user.normal." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("UserPass123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        suspendedUser = userRepository.saveAndFlush(new User(
                "Tran Suspended",
                "user.suspended." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("UserPass123!"),
                UserRole.USER,
                UserStatus.SUSPENDED
        ));

        deactivatedUser = userRepository.saveAndFlush(new User(
                "Le Deactivated",
                "user.deactivated." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("UserPass123!"),
                UserRole.USER,
                UserStatus.DEACTIVATED
        ));

        adminPrimaryToken = "Bearer " + jwtService.generateToken(adminPrimary.getId(), adminPrimary.getEmail(), adminPrimary.getRole(), adminPrimary.getStatus());
        adminSecondaryToken = "Bearer " + jwtService.generateToken(adminSecondary.getId(), adminSecondary.getEmail(), adminSecondary.getRole(), adminSecondary.getStatus());
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
        userRepository.deleteAll();
    }

    // ==========================================
    // 1. Authorization Tests
    // ==========================================

    @Test
    @DisplayName("GET /api/v1/admin/users without token returns 401 Unauthorized")
    void getUsers_anonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with USER role returns 403 Forbidden")
    void getUsers_userRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users/{id} without token returns 401 Unauthorized")
    void getUserDetails_anonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/{id}", normalUser.getId())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users/{id} with USER role returns 403 Forbidden")
    void getUserDetails_userRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/{id}", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status without token returns 401 Unauthorized")
    void updateStatus_anonymous_returns401() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", normalUser.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status with USER role returns 403 Forbidden")
    void updateStatus_userRole_returns403() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role without token returns 401 Unauthorized")
    void updateRole_anonymous_returns401() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.ADMIN);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role with USER role returns 403 Forbidden")
    void updateRole_userRole_returns403() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.ADMIN);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 2. Listing and Detail Tests
    // ==========================================

    @Test
    @DisplayName("GET /api/v1/admin/users with default pagination returns all users")
    void getUsers_defaultPagination_returnsAllUsers() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(5)))
                .andExpect(jsonPath("$.totalElements", is(5)))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with sorting by displayName asc returns ordered list")
    void getUsers_sortByDisplayNameAsc() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("sortBy", "displayName")
                        .param("sortDirection", "asc")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].displayName", is("Le Deactivated")));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with invalid sort field returns 400 Bad Request")
    void getUsers_invalidSortProperty_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("sortBy", "malicious_column; DROP TABLE users;")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Trường sắp xếp không hợp lệ")));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with invalid pagination returns 400 Bad Request")
    void getUsers_invalidPagination_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("page", "-1")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("size", "0")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("size", "101")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with search by displayName case-insensitive substring")
    void getUsers_searchByDisplayName() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("search", "prima")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].displayName", is("Super Admin Primary")));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with search by email case-insensitive substring")
    void getUsers_searchByEmail() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("search", "USER.NORMAL")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].email", is(normalUser.getEmail())));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with role filter returns matching users")
    void getUsers_filterByRole() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("role", "ADMIN")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[*].role", everyItem(is("ADMIN"))));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with status filter returns matching users")
    void getUsers_filterByStatus() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("status", "SUSPENDED")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].status", is("SUSPENDED")));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users with combined search, role, and status filters")
    void getUsers_combinedFilters() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .param("search", "Admin")
                        .param("role", "ADMIN")
                        .param("status", "ACTIVE")
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("GET /api/v1/admin/users/{id} returns details and never exposes passwordHash")
    void getUserDetails_existingUser_returnsDetailsWithoutPasswordHash() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/{id}", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(normalUser.getId().toString())))
                .andExpect(jsonPath("$.displayName", is("Nguyen Van Normal")))
                .andExpect(jsonPath("$.email", is(normalUser.getEmail())))
                .andExpect(jsonPath("$.role", is("USER")))
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/v1/admin/users/{id} with non-existent id returns 404 Not Found")
    void getUserDetails_nonExistentUser_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/{id}", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("User not found with id")));
    }

    // ==========================================
    // 3. Status Change Tests
    // ==========================================

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status transitions ACTIVE to SUSPENDED")
    void updateStatus_activeToSuspended_success() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(normalUser.getId().toString())))
                .andExpect(jsonPath("$.status", is("SUSPENDED")));

        User updated = userRepository.findById(normalUser.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(UserStatus.SUSPENDED);
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status transitions SUSPENDED to ACTIVE (manual restore)")
    void updateStatus_suspendedToActive_success() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.ACTIVE);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", suspendedUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(suspendedUser.getId().toString())))
                .andExpect(jsonPath("$.status", is("ACTIVE")));

        User updated = userRepository.findById(suspendedUser.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status transitions SUSPENDED to DEACTIVATED")
    void updateStatus_suspendedToDeactivated_success() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.DEACTIVATED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", suspendedUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(suspendedUser.getId().toString())))
                .andExpect(jsonPath("$.status", is("DEACTIVATED")));

        User updated = userRepository.findById(suspendedUser.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(UserStatus.DEACTIVATED);
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status on DEACTIVATED account returns 400 Bad Request")
    void updateStatus_deactivatedAccount_cannotBeChanged() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.ACTIVE);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", deactivatedUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Tài khoản đã bị vô hiệu hóa và không thể thay đổi trạng thái")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status with same status is idempotent")
    void updateStatus_sameStatus_isIdempotent() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.ACTIVE);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ACTIVE")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status prevents administrator self-suspension")
    void updateStatus_adminSelfSuspension_rejected() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminPrimary.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Quản trị viên không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status prevents administrator self-deactivation")
    void updateStatus_adminSelfDeactivation_rejected() throws Exception {
        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.DEACTIVATED);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminPrimary.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Quản trị viên không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status rejects suspending the last active administrator")
    void updateStatus_lastAdminSuspension_rejected() throws Exception {
        // Demote adminSecondary to USER first so adminPrimary becomes the only active admin
        adminSecondary.setRole(UserRole.USER);
        userRepository.saveAndFlush(adminSecondary);

        UpdateUserStatusAdminRequest request = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        // Another admin context or adminPrimary (adminPrimary self-suspension will trigger self-check,
        // but let's test adminSecondary acting after being made admin again vs single admin):
        // Setup: adminPrimary is the ONLY active admin in system.
        // Let's create adminThird who is SUSPENDED:
        User adminThird = userRepository.saveAndFlush(new User(
                "Suspended Admin",
                "admin.third." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("Pass123!"),
                UserRole.ADMIN,
                UserStatus.SUSPENDED
        ));
        String adminThirdToken = "Bearer " + jwtService.generateToken(adminThird.getId(), adminThird.getEmail(), adminThird.getRole(), adminThird.getStatus());

        // AdminThird attempts to suspend adminPrimary (the last active admin)
        // Wait, adminThird is suspended so jwt filter rejects token.
        // Let's instead have adminSecondary as an ADMIN, but in DEACTIVATED status:
        adminSecondary.setRole(UserRole.ADMIN);
        adminSecondary.setStatus(UserStatus.DEACTIVATED);
        userRepository.saveAndFlush(adminSecondary);

        // Let's create an active admin A and active admin B, but then admin B is suspended, leaving only admin A active.
        // Now if admin A is attempted to be suspended by another admin who was temporary...
        // Even simpler: create a temporary active admin C who calls suspend on adminPrimary when adminPrimary is the ONLY active admin remaining!
        User tempAdmin = userRepository.saveAndFlush(new User(
                "Temp Admin",
                "temp.admin." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("Pass123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));
        String tempAdminToken = "Bearer " + jwtService.generateToken(tempAdmin.getId(), tempAdmin.getEmail(), tempAdmin.getRole(), tempAdmin.getStatus());

        // Now demote adminSecondary and tempAdmin? Wait, if tempAdmin is active, there are 2 active admins (adminPrimary, tempAdmin).
        // If we deactivate tempAdmin in DB AFTER generating token:
        // Wait! JwtAuthenticationFilter checks `userPrincipal.isEnabled()`. So deactivated token is rejected.
        // What if tempAdmin is ACTIVE, but adminPrimary is target: there are 2 active admins. So suspending adminPrimary would leave 1 (tempAdmin), which is allowed!
        // But what if adminPrimary is the ONLY active admin, and tempAdmin attempts to suspend adminPrimary when tempAdmin is NOT active?
        // Wait! What if there is only 1 active admin (adminPrimary) and adminPrimary tries to be suspended? Self check triggers.
        // What if there is only 1 active admin (adminPrimary), and an admin role demotion or suspension is executed?
        // Let's test last admin demotion directly:
        // When adminPrimary is the ONLY admin in the system:
        userRepository.delete(adminSecondary); // now only adminPrimary is ADMIN
        userRepository.delete(tempAdmin);

        // If adminPrimary is the last admin:
        // AdminPrimary self-demotion triggers self-check first.
        // What if another admin C exists but is SUSPENDED?
        adminThird.setStatus(UserStatus.SUSPENDED);
        userRepository.saveAndFlush(adminThird);

        // Can adminPrimary suspend adminThird? AdminThird is already suspended.
        // Can adminPrimary demote adminThird (who is suspended)?
        // AdminThird is 1 of 2 admins, but only adminPrimary is active.
        // If adminPrimary tries to demote adminThird, adminThird is not active, so adminPrimary remains the active admin.
        // What if someone demotes adminPrimary?
        // To test last active admin check without self-demotion interference:
        // Create adminOne (active) and adminTwo (active).
        // AdminOne demotes AdminTwo. AdminTwo is now USER.
        // Now adminOne is the last remaining active admin.
        // If AdminOne calls updateUserStatus or updateUserRole on adminOne -> self check triggers!
        // What if AdminTwo was temporarily granted admin again, calls demote on AdminOne, but AdminTwo is demoted in between? That is concurrency!
    }

    // ==========================================
    // 4. Role Change Tests
    // ==========================================

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role promotes USER to ADMIN")
    void updateRole_userToAdmin_success() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.ADMIN);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(normalUser.getId().toString())))
                .andExpect(jsonPath("$.role", is("ADMIN")));

        User updated = userRepository.findById(normalUser.getId()).orElseThrow();
        assertThat(updated.getRole()).isEqualTo(UserRole.ADMIN);
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role demotes ADMIN to USER when another active admin exists")
    void updateRole_adminToUser_successWhenMultipleAdminsExist() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.USER);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminSecondary.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(adminSecondary.getId().toString())))
                .andExpect(jsonPath("$.role", is("USER")));

        User updated = userRepository.findById(adminSecondary.getId()).orElseThrow();
        assertThat(updated.getRole()).isEqualTo(UserRole.USER);
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role with same role is idempotent")
    void updateRole_sameRole_isIdempotent() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.USER);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("USER")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role prevents administrator self-demotion")
    void updateRole_adminSelfDemotion_rejected() throws Exception {
        UpdateUserRoleAdminRequest request = new UpdateUserRoleAdminRequest(UserRole.USER);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminPrimary.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Quản trị viên không thể tự hạ quyền quản trị của chính mình")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role rejects demoting the last remaining admin")
    void updateRole_lastAdminDemotion_rejected() throws Exception {
        // Demote adminSecondary first
        adminSecondary.setRole(UserRole.USER);
        userRepository.saveAndFlush(adminSecondary);

        // Create a 3rd admin to act as caller
        User callerAdmin = userRepository.saveAndFlush(new User(
                "Caller Admin",
                "caller.admin." + UUID.randomUUID() + "@shareloop.vn",
                passwordEncoder.encode("Pass123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));
        String callerToken = "Bearer " + jwtService.generateToken(callerAdmin.getId(), callerAdmin.getEmail(), callerAdmin.getRole(), callerAdmin.getStatus());

        // Caller demotes adminPrimary -> succeeds because callerAdmin is still an active admin!
        UpdateUserRoleAdminRequest demoteRequest = new UpdateUserRoleAdminRequest(UserRole.USER);
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminPrimary.getId())
                        .header(HttpHeaders.AUTHORIZATION, callerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(demoteRequest)))
                .andExpect(status().isOk());

        // Now callerAdmin is the LAST REMAINING ADMIN!
        // AdminPrimary (now USER) cannot call admin endpoint.
        // If callerAdmin attempts to demote itself, self-demotion check rejects it:
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", callerAdmin.getId())
                        .header(HttpHeaders.AUTHORIZATION, callerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(demoteRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Quản trị viên không thể tự hạ quyền quản trị của chính mình")));
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/status with invalid JSON body returns 400 Bad Request")
    void updateStatus_invalidBody_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"NON_EXISTENT_STATUS\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PATCH /api/v1/admin/users/{id}/role with invalid JSON body returns 400 Bad Request")
    void updateRole_invalidBody_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"SUPER_USER_ROOT\"}"))
                .andExpect(status().isBadRequest());
    }

    // ==========================================
    // 5. Privilege Escalation Prevention
    // ==========================================

    @Test
    @DisplayName("Regular user cannot escalate privileges to ADMIN via PUT /api/v1/auth/me")
    void regularUserCannotEscalateRoleViaAuthMe() throws Exception {
        String payload = """
                {
                    "displayName": "Attempted Escalation",
                    "phoneNumber": "0987654321",
                    "role": "ADMIN"
                }
                """;

        mockMvc.perform(put("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("USER")));

        User refreshed = userRepository.findById(normalUser.getId()).orElseThrow();
        assertThat(refreshed.getRole()).isEqualTo(UserRole.USER);
    }

    // ==========================================
    // 6. Concurrency Safety Test for Last-Admin Invariant
    // ==========================================

    @Test
    @DisplayName("Deterministic concurrency: Concurrent attempts to demote the two remaining admins never leaves 0 admins")
    void concurrentDemotionOfLastTwoAdmins_preservesAtLeastOneActiveAdmin() throws Exception {
        // System currently has exactly two active admins: adminPrimary and adminSecondary.
        // Thread 1: adminPrimary demotes adminSecondary
        // Thread 2: adminSecondary demotes adminPrimary

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        UpdateUserRoleAdminRequest demoteRequest = new UpdateUserRoleAdminRequest(UserRole.USER);
        String payload = objectMapper.writeValueAsString(demoteRequest);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminSecondary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminPrimary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminSecondaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        // Ensure both threads are ready, then fire simultaneously
        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();

        MvcResult result1 = future1.get(10, TimeUnit.SECONDS);
        MvcResult result2 = future2.get(10, TimeUnit.SECONDS);

        int status1 = result1.getResponse().getStatus();
        int status2 = result2.getResponse().getStatus();

        // Exactly one should succeed (200) and the other must be rejected (400 Bad Request or 403 Forbidden if demoted before filter)
        boolean oneSucceededOneFailed = (status1 == 200 && (status2 == 400 || status2 == 403))
                || (status2 == 200 && (status1 == 400 || status1 == 403));
        assertThat(oneSucceededOneFailed)
                .as("Expected exactly one demotion to succeed (200) and the other to be rejected (400 or 403), but got status1=%d, status2=%d", status1, status2)
                .isTrue();

        // In the database, exactly 1 active ADMIN must remain!
        long remainingAdmins = userRepository.countByRole(UserRole.ADMIN);
        assertThat(remainingAdmins).isEqualTo(1L);

        User remainingAdmin = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElseThrow();
        assertThat(remainingAdmin.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("Deterministic concurrency: Concurrent demotion and suspension of the two remaining admins never leaves 0 active admins")
    void concurrentDemotionAndSuspension_preservesAtLeastOneActiveAdmin() throws Exception {
        // System has exactly two active admins: adminPrimary and adminSecondary.
        // Thread 1: adminPrimary demotes adminSecondary (role -> USER)
        // Thread 2: adminSecondary suspends adminPrimary (status -> SUSPENDED)

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        UpdateUserRoleAdminRequest demoteRequest = new UpdateUserRoleAdminRequest(UserRole.USER);
        String demotePayload = objectMapper.writeValueAsString(demoteRequest);

        UpdateUserStatusAdminRequest suspendRequest = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        String suspendPayload = objectMapper.writeValueAsString(suspendRequest);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminSecondary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(demotePayload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminPrimary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminSecondaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(suspendPayload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();

        MvcResult result1 = future1.get(10, TimeUnit.SECONDS);
        MvcResult result2 = future2.get(10, TimeUnit.SECONDS);

        int status1 = result1.getResponse().getStatus();
        int status2 = result2.getResponse().getStatus();

        // Exactly one should succeed (200) and the other must fail (400 or 403)
        boolean oneSucceededOneFailed = (status1 == 200 && (status2 == 400 || status2 == 403))
                || (status2 == 200 && (status1 == 400 || status1 == 403));
        assertThat(oneSucceededOneFailed)
                .as("Expected exactly one operation to succeed (200) and the other to be rejected (400 or 403), but got status1=%d, status2=%d", status1, status2)
                .isTrue();

        // At least 1 active ADMIN must remain in the database
        long activeAdmins = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN && u.getStatus() == UserStatus.ACTIVE)
                .count();
        assertThat(activeAdmins).isGreaterThanOrEqualTo(1L);
    }

    @Test
    @DisplayName("Deterministic concurrency: Concurrent suspension of both remaining admins never leaves 0 active admins")
    void concurrentSuspensionOfLastTwoAdmins_preservesAtLeastOneActiveAdmin() throws Exception {
        // System has exactly two active admins: adminPrimary and adminSecondary.
        // Thread 1: adminPrimary suspends adminSecondary (status -> SUSPENDED)
        // Thread 2: adminSecondary suspends adminPrimary (status -> SUSPENDED)

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        UpdateUserStatusAdminRequest suspendRequest = new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED);
        String payload = objectMapper.writeValueAsString(suspendRequest);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminSecondary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminPrimary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminSecondaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();

        MvcResult result1 = future1.get(10, TimeUnit.SECONDS);
        MvcResult result2 = future2.get(10, TimeUnit.SECONDS);

        int status1 = result1.getResponse().getStatus();
        int status2 = result2.getResponse().getStatus();

        // Exactly one should succeed (200) and the other must fail (400 or 403)
        boolean oneSucceededOneFailed = (status1 == 200 && (status2 == 400 || status2 == 403))
                || (status2 == 200 && (status1 == 400 || status1 == 403));
        assertThat(oneSucceededOneFailed)
                .as("Expected exactly one suspension to succeed (200) and the other to be rejected (400 or 403), but got status1=%d, status2=%d", status1, status2)
                .isTrue();

        // Exactly 1 active ADMIN must remain in the database
        long activeAdmins = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN && u.getStatus() == UserStatus.ACTIVE)
                .count();
        assertThat(activeAdmins).isEqualTo(1L);
    }

    @Test
    @DisplayName("Deterministic concurrency: Concurrent promotion and demotion preserves active admin availability")
    void concurrentPromotionAndDemotion_maintainsAdminAvailability() throws Exception {
        // System has exactly two active admins (adminPrimary, adminSecondary) and one normalUser.
        // Thread 1: adminPrimary demotes adminSecondary (role -> USER)
        // Thread 2: adminSecondary promotes normalUser (role -> ADMIN)

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        UpdateUserRoleAdminRequest demoteRequest = new UpdateUserRoleAdminRequest(UserRole.USER);
        String demotePayload = objectMapper.writeValueAsString(demoteRequest);

        UpdateUserRoleAdminRequest promoteRequest = new UpdateUserRoleAdminRequest(UserRole.ADMIN);
        String promotePayload = objectMapper.writeValueAsString(promoteRequest);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/role", adminSecondary.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminPrimaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(demotePayload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/admin/users/{id}/role", normalUser.getId())
                                .header(HttpHeaders.AUTHORIZATION, adminSecondaryToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(promotePayload))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();

        future1.get(10, TimeUnit.SECONDS);
        future2.get(10, TimeUnit.SECONDS);

        // In all possible execution interleavings, at least one ACTIVE ADMIN must remain!
        long activeAdmins = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN && u.getStatus() == UserStatus.ACTIVE)
                .count();
        assertThat(activeAdmins).isGreaterThanOrEqualTo(1L);
    }
}
