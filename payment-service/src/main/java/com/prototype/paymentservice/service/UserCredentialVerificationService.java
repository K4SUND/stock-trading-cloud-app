package com.prototype.paymentservice.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class UserCredentialVerificationService {
    private final RestTemplate restTemplate;
    private final String userServiceUrl;
    private final String internalServiceSecret;

    public UserCredentialVerificationService(
        RestTemplate restTemplate,
        @Value("${user-service.url:http://localhost:8081}") String userServiceUrl,
        @Value("${app.internal.service-secret:dev-internal-service-secret}") String internalServiceSecret
    ) {
        this.restTemplate = restTemplate;
        this.userServiceUrl = userServiceUrl;
        this.internalServiceSecret = internalServiceSecret;
    }

    public boolean verifyPassword(Long userId, String password) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Secret", internalServiceSecret);

            HttpEntity<PasswordVerifyRequest> entity = new HttpEntity<>(
                new PasswordVerifyRequest(userId, password),
                headers
            );

            ResponseEntity<PasswordVerifyResponse> response = restTemplate.postForEntity(
                userServiceUrl + "/api/users/internal/verify-password",
                entity,
                PasswordVerifyResponse.class
            );

            return response.getBody() != null && response.getBody().valid();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to verify password right now. Please try again.");
        }
    }

    private record PasswordVerifyRequest(@NotNull Long userId, @NotBlank String password) {}

    private record PasswordVerifyResponse(boolean valid) {}
}
