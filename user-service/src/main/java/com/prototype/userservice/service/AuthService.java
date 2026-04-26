package com.prototype.userservice.service;

import com.prototype.userservice.dto.AuthRequest;
import com.prototype.userservice.dto.AuthResponse;
import com.prototype.userservice.dto.RegisterRequest;
import com.prototype.userservice.model.UserAccount;
import com.prototype.userservice.repository.UserRepository;
import com.prototype.userservice.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Set<String> ALLOWED_SELF_ROLES = Set.of("ROLE_USER", "ROLE_COMPANY");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public void register(RegisterRequest request) {
        userRepository.findByUsername(request.username()).ifPresent(u -> {
            throw new IllegalArgumentException("Username already exists");
        });
        String role = (request.role() != null && ALLOWED_SELF_ROLES.contains(request.role()))
                ? request.role() : "ROLE_USER";
        UserAccount user = new UserAccount();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(role);
        userRepository.save(user);
        log.info("Registered user username={} userId={} role={}", user.getUsername(), user.getId(), role);
    }

    public AuthResponse login(AuthRequest request) {
        UserAccount user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (!user.isActive()) {
            throw new IllegalArgumentException("Your account has been deactivated. Please contact an administrator.");
        }
        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getRole());
        log.info("Login username={} userId={} role={}", user.getUsername(), user.getId(), user.getRole());
        return new AuthResponse(user.getId(), user.getUsername(), token, user.getRole());
    }

    public boolean verifyPassword(Long userId, String rawPassword) {
        return userRepository.findById(userId)
            .filter(UserAccount::isActive)
            .map(user -> passwordEncoder.matches(rawPassword, user.getPasswordHash()))
            .orElse(false);
    }
}