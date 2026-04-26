package com.prototype.matchingengine.events;

// Consumed by matching-engine to evict the order from its in-memory book.
// Also published by matching-engine when a MARKET order can't be fully filled.
public record OrderCancelledEvent(
    Long   orderId,
    Long   userId,
    String ticker,
    int    remainingQty,
    String reason       // "USER_CANCELLED" | "MARKET_NO_LIQUIDITY"
) {}
