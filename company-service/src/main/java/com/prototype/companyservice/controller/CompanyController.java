package com.prototype.companyservice.controller;

import com.prototype.companyservice.dto.*;
import com.prototype.companyservice.service.CompanyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {
    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) { this.companyService = companyService; }

    // ── Public endpoints ──────────────────────────────────────
    @GetMapping("/public/all")
    public ResponseEntity<List<CompanyProfileResponse>> allCompanies() {
        return ResponseEntity.ok(companyService.getAllProfiles());
    }

    @GetMapping("/public/stocks")
    public ResponseEntity<List<StockListingResponse>> allStocks() {
        return ResponseEntity.ok(companyService.getAllStocks());
    }

    // ── Company-only endpoints ────────────────────────────────
    @GetMapping("/profile")
    public ResponseEntity<CompanyProfileResponse> getProfile(Authentication auth) {
        return ResponseEntity.ok(companyService.getProfile(userId(auth)));
    }

    @PostMapping("/profile")
    public ResponseEntity<CompanyProfileResponse> saveProfile(@Valid @RequestBody CompanyProfileRequest request,
                                                               Authentication auth) {
        return ResponseEntity.ok(companyService.saveProfile(userId(auth), request));
    }

    @GetMapping("/stocks")
    public ResponseEntity<List<StockListingResponse>> myStocks(Authentication auth) {
        return ResponseEntity.ok(companyService.getMyStocks(userId(auth)));
    }

    @PostMapping("/stocks")
    public ResponseEntity<StockListingResponse> listStock(@Valid @RequestBody StockListingRequest request,
                                                           Authentication auth) {
        return ResponseEntity.ok(companyService.listStock(userId(auth), request));
    }

    @PutMapping("/stocks/{ticker}")
    public ResponseEntity<StockListingResponse> updateStock(@PathVariable String ticker,
                                                             @Valid @RequestBody StockListingRequest request,
                                                             Authentication auth) {
        return ResponseEntity.ok(companyService.updateStock(userId(auth), ticker, request));
    }

    private Long userId(Authentication auth) { return (Long) auth.getPrincipal(); }
}
