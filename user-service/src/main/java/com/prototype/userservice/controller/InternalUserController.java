package com.prototype.userservice.controller;

import com.prototype.userservice.dto.InternalPasswordVerifyRequest;
import com.prototype.userservice.dto.InternalPasswordVerifyResponse;
import com.prototype.userservice.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users/internal")
public class InternalUserController {
    private final AuthService authService;
    private final String internalServiceSecret;

    public InternalUserController(
        AuthService authService,
        @Value("${app.internal.service-secret:dev-internal-service-secret}") String internalServiceSecret
    ) {
        this.authService = authService;
        this.internalServiceSecret = internalServiceSecret;
    }

    @PostMapping("/verify-password")
    public ResponseEntity<InternalPasswordVerifyResponse> verifyPassword(
        @RequestHeader(value = "X-Internal-Secret", required = false) String incomingSecret,
        @Valid @RequestBody InternalPasswordVerifyRequest request
    ) {
        if (incomingSecret == null || !incomingSecret.equals(internalServiceSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden internal request");
        }
        boolean valid = authService.verifyPassword(request.userId(), request.password());
        return ResponseEntity.ok(new InternalPasswordVerifyResponse(valid));
    }
}
