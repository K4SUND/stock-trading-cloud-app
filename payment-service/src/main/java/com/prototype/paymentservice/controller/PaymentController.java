package com.prototype.paymentservice.controller;

import com.prototype.paymentservice.dto.DeductRequest;
import com.prototype.paymentservice.dto.TopupRequest;
import com.prototype.paymentservice.dto.WalletResponse;
import com.prototype.paymentservice.service.WalletService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final WalletService walletService;

    public PaymentController(WalletService walletService) {
        this.walletService = walletService;
    }

    @PostMapping("/wallet/topup")
    public ResponseEntity<WalletResponse> topup(@Valid @RequestBody TopupRequest request, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(walletService.topup(userId, request));
    }

    @GetMapping("/wallet")
    public ResponseEntity<WalletResponse> wallet(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(walletService.getWallet(userId));
    }

    // Called by order-service synchronously during IPO purchase — no JWT needed
    @PostMapping("/internal/deduct")
    public ResponseEntity<Void> internalDeduct(@RequestBody DeductRequest request) {
        walletService.deduct(request.userId(), request.amount());
        return ResponseEntity.ok().build();
    }
}
