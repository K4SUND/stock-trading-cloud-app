package com.prototype.orderservice.events;

public record OrderCancelledEvent(
    Long orderId,
    String ticker,
    int remainingQty,
    String reason
) {}
