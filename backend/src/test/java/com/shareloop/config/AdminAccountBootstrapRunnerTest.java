package com.shareloop.config;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAccountBootstrapRunnerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private Environment environment;

    private AdminAccountBootstrapRunner runner;

    @BeforeEach
    void setUp() {
        runner = new AdminAccountBootstrapRunner(userRepository, passwordEncoder, environment);
    }

    @Nested
    @DisplayName("Disabled State Checks")
    class DisabledStateTests {

        @Test
        @DisplayName("Should perform no action when app.admin-bootstrap.enabled is false")
        void shouldDoNothingWhenDisabled() {
            when(environment.getProperty("app.admin-bootstrap.enabled", "false")).thenReturn("false");

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isFalse();
            verifyNoInteractions(userRepository);
            verifyNoInteractions(passwordEncoder);
        }

        @Test
        @DisplayName("Should perform no action when enabled property is missing")
        void shouldDoNothingWhenPropertyMissing() {
            when(environment.getProperty("app.admin-bootstrap.enabled", "false")).thenReturn("false");

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isFalse();
            verifyNoInteractions(userRepository);
        }
    }

    @Nested
    @DisplayName("Credential Validation Checks")
    class CredentialValidationTests {

        @BeforeEach
        void enableBootstrap() {
            when(environment.getProperty("app.admin-bootstrap.enabled", "false")).thenReturn("true");
            when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        }

        @Test
        @DisplayName("Should fail safely when email is missing or blank")
        void shouldFailWhenEmailIsBlank() {
            when(environment.getProperty("app.admin-bootstrap.email")).thenReturn("   ");
            when(environment.getProperty("app.admin-bootstrap.password")).thenReturn("StrongPassword123!");
            when(environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop")).thenReturn("Admin");

            assertThatThrownBy(() -> runner.bootstrapAdmin())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("blank or missing");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should fail safely when password is missing or blank")
        void shouldFailWhenPasswordIsBlank() {
            when(environment.getProperty("app.admin-bootstrap.email")).thenReturn("admin@shareloop.vn");
            when(environment.getProperty("app.admin-bootstrap.password")).thenReturn("");
            when(environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop")).thenReturn("Admin");

            assertThatThrownBy(() -> runner.bootstrapAdmin())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("blank or missing");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should reject password shorter than 12 characters")
        void shouldRejectWeakPassword() {
            when(environment.getProperty("app.admin-bootstrap.email")).thenReturn("admin@shareloop.vn");
            when(environment.getProperty("app.admin-bootstrap.password")).thenReturn("Short123!");
            when(environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop")).thenReturn("Admin");

            assertThatThrownBy(() -> runner.bootstrapAdmin())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Minimum length is 12 characters");

            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Idempotency & Duplicate Prevention Checks")
    class IdempotencyTests {

        @BeforeEach
        void configureValidInputs() {
            when(environment.getProperty("app.admin-bootstrap.enabled", "false")).thenReturn("true");
            when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
            when(environment.getProperty("app.admin-bootstrap.email")).thenReturn("NewAdmin@ShareLoop.VN ");
            when(environment.getProperty("app.admin-bootstrap.password")).thenReturn("ValidAdminSecurePass123!");
            when(environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop")).thenReturn("Root Administrator");
        }

        @Test
        @DisplayName("Should skip creation when an Administrator account already exists in DB")
        void shouldSkipWhenAdminAlreadyExists() {
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(true);

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isFalse();
            verify(userRepository).existsByRole(UserRole.ADMIN);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should fail and refuse to promote existing USER account with configured email")
        void shouldNeverPromoteExistingUser() {
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(false);
            User ordinaryUser = new User("John Doe", "newadmin@shareloop.vn", "hash", UserRole.USER, UserStatus.ACTIVE);
            when(userRepository.findByEmailIgnoreCase("newadmin@shareloop.vn")).thenReturn(Optional.of(ordinaryUser));

            assertThatThrownBy(() -> runner.bootstrapAdmin())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("automatic role escalation is strictly prohibited");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should create Admin successfully when no Admin exists and email is free")
        void shouldCreateAdminSuccessfully() {
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(false);
            when(userRepository.findByEmailIgnoreCase("newadmin@shareloop.vn")).thenReturn(Optional.empty());
            when(passwordEncoder.encode("ValidAdminSecurePass123!")).thenReturn("$2a$10$encodedPasswordHashMock");

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isTrue();
            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());

            User created = captor.getValue();
            assertThat(created.getRole()).isEqualTo(UserRole.ADMIN);
            assertThat(created.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(created.getEmail()).isEqualTo("newadmin@shareloop.vn");
            assertThat(created.getDisplayName()).isEqualTo("Root Administrator");
            assertThat(created.getPasswordHash()).isEqualTo("$2a$10$encodedPasswordHashMock");
        }

        @Test
        @DisplayName("Should be idempotent on subsequent application restarts after creation")
        void shouldBeIdempotentOnSubsequentRuns() {
            // First run creates admin
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(false);
            when(userRepository.findByEmailIgnoreCase("newadmin@shareloop.vn")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("encoded");
            assertThat(runner.bootstrapAdmin()).isTrue();

            // Subsequent run detects existing admin
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(true);
            assertThat(runner.bootstrapAdmin()).isFalse();

            verify(userRepository, times(1)).save(any());
        }
    }

    @Nested
    @DisplayName("Production Safeguard Checks")
    class ProductionSafeguardTests {

        @BeforeEach
        void configureInputs() {
            when(environment.getProperty("app.admin-bootstrap.enabled", "false")).thenReturn("true");
            when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true); // Is production
        }

        @Test
        @DisplayName("Should block bootstrap in production when production-confirmed is false")
        void shouldBlockInProductionWithoutConfirmation() {
            when(environment.getProperty("app.admin-bootstrap.production-confirmed", "false")).thenReturn("false");

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isFalse();
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("Should allow bootstrap in production when production-confirmed is explicitly true")
        void shouldAllowInProductionWithExplicitConfirmation() {
            when(environment.getProperty("app.admin-bootstrap.production-confirmed", "false")).thenReturn("true");
            when(environment.getProperty("app.admin-bootstrap.email")).thenReturn("prodadmin@shareloop.vn");
            when(environment.getProperty("app.admin-bootstrap.password")).thenReturn("ProdSuperSecure123!");
            when(environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop")).thenReturn("Prod Admin");
            when(userRepository.existsByRole(UserRole.ADMIN)).thenReturn(false);
            when(userRepository.findByEmailIgnoreCase("prodadmin@shareloop.vn")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(any())).thenReturn("encodedProdHash");

            boolean result = runner.bootstrapAdmin();

            assertThat(result).isTrue();
            verify(userRepository).save(any(User.class));
        }
    }
}
