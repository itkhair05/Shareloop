package com.shareloop.identity;

import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.UserIdentity;
import com.shareloop.entity.enums.IdentityProvider;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.InvalidCredentialsException;
import com.shareloop.repository.UserIdentityRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
class UserIdentityIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserIdentityRepository userIdentityRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Migration succeeds and user_identities table exists in database")
    void userIdentitiesTableExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_identities'",
                Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("Existing users and non-null password hashes are preserved")
    void existingUsersAndPasswordHashesArePreserved() {
        String testEmail = "existing.user." + UUID.randomUUID() + "@shareloop.vn";
        String rawPassword = "Password123!";
        User existingUser = new User(
                "Existing Member",
                testEmail,
                passwordEncoder.encode(rawPassword),
                UserRole.USER,
                UserStatus.ACTIVE
        );
        userRepository.saveAndFlush(existingUser);

        User loadedUser = userRepository.findByEmail(testEmail).orElseThrow();
        assertThat(loadedUser.getPasswordHash()).isNotNull();
        assertThat(passwordEncoder.matches(rawPassword, loadedUser.getPasswordHash())).isTrue();

        // Email/password login succeeds
        var response = authService.login(new LoginRequest(testEmail, rawPassword));
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isNotBlank();
        assertThat(response.getEmail()).isEqualTo(testEmail);
    }

    @Test
    @DisplayName("password_hash column accepts NULL for Google-only users")
    void passwordHashAcceptsNull() {
        String testEmail = "google.only." + UUID.randomUUID() + "@shareloop.vn";
        User googleOnlyUser = new User(
                "Google Only User",
                testEmail,
                null, // null password_hash
                UserRole.USER,
                UserStatus.ACTIVE
        );
        userRepository.saveAndFlush(googleOnlyUser);

        User loaded = userRepository.findByEmail(testEmail).orElseThrow();
        assertThat(loaded.getId()).isNotNull();
        assertThat(loaded.getPasswordHash()).isNull();

        // Also verify directly via raw SQL
        String dbPasswordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM users WHERE id = ?",
                String.class,
                loaded.getId()
        );
        assertThat(dbPasswordHash).isNull();
    }

    @Test
    @DisplayName("Google-only users with NULL password hash cannot authenticate via password login")
    void googleOnlyUserWithNullPasswordHashCannotAuthenticateThroughPasswordLogin() {
        String testEmail = "google.login.reject." + UUID.randomUUID() + "@shareloop.vn";
        User googleOnlyUser = new User(
                "Google Login Reject",
                testEmail,
                null,
                UserRole.USER,
                UserStatus.ACTIVE
        );
        userRepository.saveAndFlush(googleOnlyUser);

        assertThatThrownBy(() -> authService.login(new LoginRequest(testEmail, "AnyRandomPassword123!")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    @DisplayName("Duplicate (provider, provider_subject) is rejected by database constraint")
    void duplicateProviderSubjectIsRejected() {
        String sub = "google-sub-" + UUID.randomUUID();

        User user1 = userRepository.saveAndFlush(new User("User 1", "u1." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        User user2 = userRepository.saveAndFlush(new User("User 2", "u2." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));

        UserIdentity identity1 = new UserIdentity(user1, IdentityProvider.GOOGLE, sub, "user1@gmail.com");
        userIdentityRepository.saveAndFlush(identity1);

        UserIdentity identity2 = new UserIdentity(user2, IdentityProvider.GOOGLE, sub, "user2@gmail.com");
        assertThatThrownBy(() -> userIdentityRepository.saveAndFlush(identity2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Duplicate (user_id, provider) is rejected by database constraint")
    void duplicateUserProviderIsRejected() {
        User user = userRepository.saveAndFlush(new User("Single Google Account", "single." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));

        UserIdentity identity1 = new UserIdentity(user, IdentityProvider.GOOGLE, "sub-1-" + UUID.randomUUID(), "account1@gmail.com");
        userIdentityRepository.saveAndFlush(identity1);

        UserIdentity identity2 = new UserIdentity(user, IdentityProvider.GOOGLE, "sub-2-" + UUID.randomUUID(), "account2@gmail.com");
        assertThatThrownBy(() -> userIdentityRepository.saveAndFlush(identity2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Deleting user cascades and automatically deletes linked user_identities")
    void userDeletionCascadesToUserIdentities() {
        User user = userRepository.saveAndFlush(new User("To Be Deleted", "delete.me." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        String sub = "sub-del-" + UUID.randomUUID();
        UserIdentity identity = userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, sub, "del@gmail.com"));

        UUID identityId = identity.getId();
        UUID userId = user.getId();

        assertThat(userIdentityRepository.findById(identityId)).isPresent();

        // Delete user via database SQL to trigger foreign key ON DELETE CASCADE
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);

        // Verify via raw SQL that child record was cascaded away
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_identities WHERE id = ?",
                Integer.class,
                identityId
        );
        assertThat(count).isEqualTo(0);
    }

    @Test
    @DisplayName("Repository lookup methods operate correctly")
    void repositoryLookupMethodsWorkCorrectly() {
        User user = userRepository.saveAndFlush(new User("Repo Test User", "repo." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        String sub = "google-sub-" + UUID.randomUUID();
        String googleEmail = "repo.test@gmail.com";

        UserIdentity identity = userIdentityRepository.saveAndFlush(
                new UserIdentity(user, IdentityProvider.GOOGLE, sub, googleEmail)
        );

        // 1. findByProviderAndProviderSubject
        Optional<UserIdentity> bySub = userIdentityRepository.findByProviderAndProviderSubject(IdentityProvider.GOOGLE, sub);
        assertThat(bySub).isPresent();
        assertThat(bySub.get().getProviderEmail()).isEqualTo(googleEmail);
        assertThat(bySub.get().getUser().getId()).isEqualTo(user.getId());

        // 2. findByUserAndProvider
        Optional<UserIdentity> byUserAndProvider = userIdentityRepository.findByUserAndProvider(user, IdentityProvider.GOOGLE);
        assertThat(byUserAndProvider).isPresent();
        assertThat(byUserAndProvider.get().getProviderSubject()).isEqualTo(sub);

        // 3. findByUserIdAndProvider
        Optional<UserIdentity> byUserIdAndProvider = userIdentityRepository.findByUserIdAndProvider(user.getId(), IdentityProvider.GOOGLE);
        assertThat(byUserIdAndProvider).isPresent();
        assertThat(byUserIdAndProvider.get().getId()).isEqualTo(identity.getId());

        // 4. existsByProviderAndProviderSubject
        assertThat(userIdentityRepository.existsByProviderAndProviderSubject(IdentityProvider.GOOGLE, sub)).isTrue();
        assertThat(userIdentityRepository.existsByProviderAndProviderSubject(IdentityProvider.GOOGLE, "non-existent-sub")).isFalse();

        // 5. existsByUserIdAndProvider
        assertThat(userIdentityRepository.existsByUserIdAndProvider(user.getId(), IdentityProvider.GOOGLE)).isTrue();
        assertThat(userIdentityRepository.existsByUserIdAndProvider(UUID.randomUUID(), IdentityProvider.GOOGLE)).isFalse();

        // 6. findByUserId
        List<UserIdentity> identities = userIdentityRepository.findByUserId(user.getId());
        assertThat(identities).hasSize(1);
        assertThat(identities.get(0).getProviderSubject()).isEqualTo(sub);
    }
}
