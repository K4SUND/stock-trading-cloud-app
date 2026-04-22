package com.prototype.paymentservice.events;

import com.prototype.paymentservice.model.OrderType;

import java.math.BigDecimal;

public record OrderCreatedEvent(Long orderId, Long userId, String stockTicker, Integer quantity, BigDecimal price, OrderType type) {}
