package com.prototype.priceservice.events;

import com.prototype.priceservice.model.OrderType;

import java.math.BigDecimal;

public record OrderCompletedEvent(Long orderId, String stockTicker, Integer quantity, BigDecimal price, OrderType type) {}
