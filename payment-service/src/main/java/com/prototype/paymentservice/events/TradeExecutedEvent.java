package com.prototype.paymentservice.events;

import java.math.BigDecimal;

public record TradeExecutedEvent(
    String tradeId,
    String ticker,
    Long buyOrderId,
    Long sellOrderId,
    Long buyerId,
    Long sellerId,
    Integer quantity,
    BigDecimal price,
    BigDecimal value,
    long timestamp
) {}
