package com.prototype.orderservice.events;

import java.math.BigDecimal;

public record OrderPlacedEvent(
    Long orderId,
    Long userId,
    String ticker,
    String side,        // "BUY" | "SELL"
    String mode,        // "LIMIT" | "MARKET"
    BigDecimal limitPrice,
    Integer quantity,
    long timestamp
) {}
