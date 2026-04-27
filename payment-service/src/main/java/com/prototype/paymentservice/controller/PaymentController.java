package com.prototype.paymentservice.controller;

import com.prototype.paymentservice.dto.CardTopupRequest;
import com.prototype.paymentservice.dto.CardTopupResponse;
import com.prototype.paymentservice.dto.DeductRequest;
import com.prototype.paymentservice.dto.TopupRequest;
import com.prototype.paymentservice.dto.WithdrawRequest;
import com.prototype.paymentservice.dto.WalletResponse;
import com.prototype.paymentservice.dto.WalletTransactionResponse;
import com.prototype.paymentservice.service.WalletService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final WalletService walletService;

    public PaymentController(WalletService walletService) {
        this.walletService = walletService;
    }

    @PostMapping("/wallet/topup")
    public ResponseEntity<?> topup(@Valid @RequestBody TopupRequest request, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        try {
            return ResponseEntity.ok(walletService.topup(userId, request));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/wallet/withdraw")
    public ResponseEntity<?> withdraw(@Valid @RequestBody WithdrawRequest request, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        try {
            return ResponseEntity.ok(walletService.withdraw(userId, request));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/wallet")
    public ResponseEntity<WalletResponse> wallet(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(walletService.getWallet(userId));
    }

    @PostMapping({"/wallet/topup/card", "/wallet/topup/card/sandbox"})
    public ResponseEntity<?> topupBySandboxCard(
        @Valid @RequestBody CardTopupRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        try {
            CardTopupResponse response = walletService.topupBySandboxCard(userId, request);
            return ResponseEntity.ok(response);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                .body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/wallet/transactions")
    public ResponseEntity<List<WalletTransactionResponse>> transactions(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(walletService.getRecentTransactions(userId));
    }

    @GetMapping("/admin/users/{userId}/wallet")
    public ResponseEntity<WalletResponse> adminWallet(@PathVariable Long userId) {
        return ResponseEntity.ok(walletService.getWallet(userId));
    }

    // Called by order-service synchronously during IPO purchase — no JWT needed
    @PostMapping("/internal/deduct")
    public ResponseEntity<Void> internalDeduct(@RequestBody DeductRequest request) {
        walletService.deduct(request.userId(), request.amount());
        return ResponseEntity.ok().build();
    }
}
