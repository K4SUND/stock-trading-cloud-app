package com.prototype.notificationservice.events;

import java.math.BigDecimal;

public record OrderPlacedEvent(
    Long orderId,
    Long userId,
    String ticker,
    String side,
    String mode,
    BigDecimal limitPrice,
    Integer quantity,
    long timestamp
) {}
