package com.prototype.orderservice.controller;

import com.prototype.orderservice.dto.*;
import com.prototype.orderservice.service.OrderProcessingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderProcessingService orderProcessingService;

    public OrderController(OrderProcessingService orderProcessingService) {
        this.orderProcessingService = orderProcessingService;
    }

    // ── Secondary market order placement (enters matching engine) ────────────
    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
            @Valid @RequestBody CreateOrderRequest request, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.createOrder(userId, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelOrder(@PathVariable Long id, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        orderProcessingService.cancelOrder(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> userOrders(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.userOrders(userId));
    }

    @GetMapping("/portfolio")
    public ResponseEntity<List<PortfolioResponse>> portfolio(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.portfolio(userId));
    }

    @GetMapping("/trades")
    public ResponseEntity<List<TradeResponse>> trades(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.userTrades(userId));
    }

    @GetMapping("/ipo-purchases")
    public ResponseEntity<List<IpoPurchaseResponse>> ipoPurchases(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.userIpoPurchases(userId));
    }

    @GetMapping("/holders")
    public ResponseEntity<List<HolderResponse>> holders(@RequestParam List<String> tickers) {
        return ResponseEntity.ok(orderProcessingService.holdersForTickers(tickers));
    }

    // ── Primary market (IPO) endpoints ───────────────────────────────────────

    // Public — list all IPO allocations (how many shares remain at IPO price per ticker)
    @GetMapping("/ipo")
    public ResponseEntity<List<IpoAllocationResponse>> getIpoAllocations() {
        return ResponseEntity.ok(orderProcessingService.getIpoAllocations());
    }

    // Public — single ticker IPO info
    @GetMapping("/ipo/{ticker}")
    public ResponseEntity<IpoAllocationResponse> getIpoAllocation(@PathVariable String ticker) {
        IpoAllocationResponse r = orderProcessingService.getIpoAllocation(ticker);
        return r != null ? ResponseEntity.ok(r) : ResponseEntity.notFound().build();
    }

    // Authenticated — buy directly from IPO at fixed price (no matching engine)
    @PostMapping("/ipo-buy")
    public ResponseEntity<IpoAllocationResponse> ipoBuy(
            @RequestBody IpoBuyRequest request, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.ipoBuy(userId, request.ticker(), request.quantity()));
    }

    // ── Public market feeds ───────────────────────────────────────────────────
    @GetMapping("/market/trades")
    public ResponseEntity<List<TradeResponse>> marketTrades() {
        return ResponseEntity.ok(orderProcessingService.recentMarketTrades());
    }

    @GetMapping("/market/status")
    public ResponseEntity<java.util.Map<String, Object>> marketStatus() {
        return ResponseEntity.ok(java.util.Map.of("open", orderProcessingService.isMarketOpen()));
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @PostMapping("/admin/market/open")
    public ResponseEntity<java.util.Map<String, Object>> openMarket() {
        orderProcessingService.setMarketOpen(true);
        return ResponseEntity.ok(java.util.Map.of("open", true));
    }

    @PostMapping("/admin/market/close")
    public ResponseEntity<java.util.Map<String, Object>> closeMarket() {
        orderProcessingService.setMarketOpen(false);
        return ResponseEntity.ok(java.util.Map.of("open", false));
    }

    @GetMapping("/admin/users/{userId}/orders")
    public ResponseEntity<List<OrderResponse>> adminUserOrders(@PathVariable Long userId) {
        return ResponseEntity.ok(orderProcessingService.userOrders(userId));
    }

    @GetMapping("/admin/users/{userId}/portfolio")
    public ResponseEntity<List<PortfolioResponse>> adminUserPortfolio(@PathVariable Long userId) {
        return ResponseEntity.ok(orderProcessingService.portfolio(userId));
    }

    // ── Internal endpoints ────────────────────────────────────────────────────

    // Called by company-service when a stock is listed (IPO allocation setup)
    @PostMapping("/internal/issue-shares")
    public ResponseEntity<Void> issueShares(@RequestBody IssueSharesRequest request) {
        orderProcessingService.issueShares(
            request.companyUserId(), request.ticker(),
            request.totalShares(), request.issuePrice());
        return ResponseEntity.ok().build();
    }

    // Called by matching-engine on startup for order book recovery
    @GetMapping("/internal/open")
    public ResponseEntity<List<OpenOrderView>> openOrders() {
        return ResponseEntity.ok(orderProcessingService.getOpenOrders());
    }
}
