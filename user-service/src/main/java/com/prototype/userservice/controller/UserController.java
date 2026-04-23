package com.prototype.userservice.controller;

import com.prototype.userservice.dto.UserSummary;
import com.prototype.userservice.model.UserAccount;
import com.prototype.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private static final Logger log = LoggerFactory.getLogger(UserController.class);
    private static final Set<String> VALID_ROLES = Set.of("ROLE_USER", "ROLE_COMPANY", "ROLE_ADMIN");

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) { this.userRepository = userRepository; }

    @GetMapping("/me")
    public ResponseEntity<UserSummary> me(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return userRepository.findById(userId)
                .map(u -> ResponseEntity.ok(new UserSummary(u.getId(), u.getUsername(), u.getRole())))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/batch")
    public ResponseEntity<List<UserSummary>> batchUsers(@RequestParam List<Long> ids) {
        List<UserSummary> users = userRepository.findAllById(ids).stream()
                .map(u -> new UserSummary(u.getId(), u.getUsername(), u.getRole()))
                .toList();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/admin/users")
    public ResponseEntity<List<UserSummary>> allUsers() {
        List<UserSummary> users = userRepository.findAll().stream()
                .map(u -> new UserSummary(u.getId(), u.getUsername(), u.getRole()))
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/admin/users/{id}/role")
    public ResponseEntity<UserSummary> changeRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newRole = body.get("role");
        if (newRole == null || !VALID_ROLES.contains(newRole)) {
            throw new IllegalArgumentException("Invalid role: " + newRole);
        }
        UserAccount user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setRole(newRole);
        userRepository.save(user);
        log.info("Admin changed role userId={} newRole={}", id, newRole);
        return ResponseEntity.ok(new UserSummary(user.getId(), user.getUsername(), user.getRole()));
    }
}