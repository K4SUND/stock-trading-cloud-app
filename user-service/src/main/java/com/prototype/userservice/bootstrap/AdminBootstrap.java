package com.prototype.userservice.bootstrap;

import com.prototype.userservice.model.UserAccount;
import com.prototype.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Provisions the first admin account on startup if none exists.
 *
 * Security model:
 *   - Credentials come ONLY from environment variables (ADMIN_USERNAME, ADMIN_PASSWORD).
 *   - Password is BCrypt-hashed before storage — never stored in plain text.
 *   - Idempotent: safe to run on every restart; skips if an admin already exists.
 *   - Self-registration via /api/users/register cannot create ROLE_ADMIN (enforced
 *     in AuthService). This is the ONLY code path that creates an admin account.
 *
 * In production: supply ADMIN_PASSWORD via Docker Secret / K8s Secret / vault.
 * Never commit real credentials to source control.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.username}")
    private String adminUsername;

    @Value("${admin.password}")
    private String adminPassword;

    public AdminBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByRole("ROLE_ADMIN")) {
            log.info("Admin account already exists — skipping bootstrap.");
            return;
        }

        UserAccount admin = new UserAccount();
        admin.setUsername(adminUsername);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setRole("ROLE_ADMIN");
        userRepository.save(admin);

        log.warn("╔══════════════════════════════════════════════════════╗");
        log.warn("║            ADMIN ACCOUNT PROVISIONED                ║");
        log.warn("║  Username : {}                                  ║", adminUsername);
        log.warn("║  Change ADMIN_PASSWORD via environment variable!    ║");
        log.warn("╚══════════════════════════════════════════════════════╝");
    }
}