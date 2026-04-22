package com.prototype.userservice.service;

import com.prototype.userservice.dto.AuthRequest;
import com.prototype.userservice.dto.AuthResponse;
import com.prototype.userservice.model.UserAccount;
import com.prototype.userservice.repository.UserRepository;
import com.prototype.userservice.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public void register(AuthRequest request) {
        userRepository.findByUsername(request.username()).ifPresent(u -> {
            throw new IllegalArgumentException("Username already exists");
        });
        UserAccount user = new UserAccount();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        log.info("Registered new user username={} userId={}", user.getUsername(), user.getId());
    }

    public AuthResponse login(AuthRequest request) {
        UserAccount user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        String token = jwtService.generateToken(user.getId(), user.getUsername());
        log.info("Login successful username={} userId={}", user.getUsername(), user.getId());
        return new AuthResponse(user.getId(), user.getUsername(), token);
    }
}
