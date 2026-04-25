package com.prototype.matchingengine.dto;

import java.math.BigDecimal;

// DTO returned by order-service's /api/orders/internal/open — used on startup to rebuild books
public record OpenOrderDto(
    Long orderId,
    Long userId,
    String ticker,
    String side,
    String mode,
    BigDecimal limitPrice,
    int remainingQty,
    long placedAt
) {}
