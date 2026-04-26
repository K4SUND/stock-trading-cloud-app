package com.prototype.notificationservice.events;

public record OrderCancelledEvent(
    Long orderId,
    Long userId,
    String ticker,
    int remainingQty,
    String reason
) {}
