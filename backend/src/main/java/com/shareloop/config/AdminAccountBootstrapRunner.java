package com.shareloop.config;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

/**
 * Controlled, opt-in bootstrap mechanism to provision the initial Administrator account.
 *
 * Security guarantees:
 * - Disabled by default (requires explicit opt-in 'app.admin-bootstrap.enabled=true').
 * - Requires environment-provided credentials; never uses default or hardcoded secrets.
 * - Enforces minimum password strength (at least 12 characters).
 * - Normalizes email identically to authentication service.
 * - Idempotent: Skips execution if any Admin account already exists.
 * - Prevents silent privilege escalation: Refuses to promote an existing USER account.
 * - Production safeguard: Requires explicit production confirmation in production profile.
 * - Zero secret leakage: Credentials and passwords are never logged or stored in plain text.
 */
@Component
@ConditionalOnProperty(name = "app.admin-bootstrap.enabled", havingValue = "true")
public class AdminAccountBootstrapRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminAccountBootstrapRunner.class);
    private static final int MIN_PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    public AdminAccountBootstrapRunner(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            Environment environment
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    public void run(String... args) {
        bootstrapAdmin();
    }

    @Transactional
    public boolean bootstrapAdmin() {
        boolean enabled = Boolean.parseBoolean(environment.getProperty("app.admin-bootstrap.enabled", "false"));
        if (!enabled) {
            log.debug("Admin bootstrap is disabled. Skipping.");
            return false;
        }

        // 1. Production Safety Guard
        if (environment.acceptsProfiles(Profiles.of("prod", "production"))) {
            boolean productionConfirmed = Boolean.parseBoolean(
                    environment.getProperty("app.admin-bootstrap.production-confirmed", "false")
            );
            if (!productionConfirmed) {
                log.warn("Admin bootstrap blocked: running in production profile without explicit confirmation " +
                        "(app.admin-bootstrap.production-confirmed=true). Aborting bootstrap.");
                return false;
            }
        }

        // 2. Read and validate configured credentials
        String email = environment.getProperty("app.admin-bootstrap.email");
        String password = environment.getProperty("app.admin-bootstrap.password");
        String name = environment.getProperty("app.admin-bootstrap.name", "Admin ShareLoop");

        if (email == null || email.isBlank()) {
            throw new IllegalStateException("Admin bootstrap is enabled, but 'app.admin-bootstrap.email' is blank or missing.");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalStateException("Admin bootstrap is enabled, but 'app.admin-bootstrap.password' is blank or missing.");
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalStateException("Admin bootstrap password does not meet security requirements. " +
                    "Minimum length is " + MIN_PASSWORD_LENGTH + " characters.");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        // 3. Check if any Admin account already exists
        if (userRepository.existsByRole(UserRole.ADMIN)) {
            log.info("Admin bootstrap skipped: at least one administrator account already exists in the system.");
            return false;
        }

        // 4. Check if the email belongs to an existing user (prevent privilege escalation)
        Optional<User> existingUser = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingUser.isPresent()) {
            log.error("Admin bootstrap failed: configured email belongs to an existing account with role [{}]. " +
                    "Automatic role elevation is strictly prohibited.", existingUser.get().getRole());
            throw new IllegalStateException("Configured bootstrap email already belongs to an existing user; " +
                    "automatic role escalation is strictly prohibited.");
        }

        // 5. Create the initial Admin user safely
        String displayName = (name != null && !name.isBlank()) ? name.trim() : "Admin ShareLoop";
        User admin = new User(
                displayName,
                normalizedEmail,
                passwordEncoder.encode(password),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        );

        userRepository.save(admin);
        log.info("Initial Administrator account successfully bootstrapped for '{}'.", maskEmail(normalizedEmail));
        return true;
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        int atIndex = email.indexOf('@');
        String name = email.substring(0, atIndex);
        String domain = email.substring(atIndex);
        if (name.length() <= 2) {
            return name.charAt(0) + "***" + domain;
        }
        return name.substring(0, 2) + "***" + domain;
    }
}
