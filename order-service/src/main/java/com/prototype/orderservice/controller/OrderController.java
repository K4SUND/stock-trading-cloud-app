package com.prototype.orderservice.controller;

import com.prototype.orderservice.dto.CreateOrderRequest;
import com.prototype.orderservice.dto.OrderResponse;
import com.prototype.orderservice.dto.PortfolioResponse;
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

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody CreateOrderRequest request, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.createOrder(userId, request));
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> userOrders(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.userOrders(userId));
    }

    @GetMapping("/portfolio")
    public ResponseEntity<List<PortfolioResponse>> portfolio(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(orderProcessingService.portfolio(userId));
    }
}
