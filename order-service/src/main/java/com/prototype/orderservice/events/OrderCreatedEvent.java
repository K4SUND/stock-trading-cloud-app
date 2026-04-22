package com.prototype.orderservice.events;

import com.prototype.orderservice.model.OrderType;

import java.math.BigDecimal;

public record OrderCreatedEvent(Long orderId, Long userId, String stockTicker, Integer quantity, BigDecimal price, OrderType type) {}
