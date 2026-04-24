package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.Trade;
import java.math.BigDecimal;

public record TradeResponse(
    String id,
    String ticker,
    Long buyOrderId,
    Long sellOrderId,
    Long buyerId,
    Long sellerId,
    Integer quantity,
    BigDecimal price,
    BigDecimal value,
    long executedAt
) {
    public static TradeResponse from(Trade t) {
        return new TradeResponse(t.getId(), t.getTicker(),
            t.getBuyOrderId(), t.getSellOrderId(),
            t.getBuyerId(), t.getSellerId(),
            t.getQuantity(), t.getPrice(), t.getValue(),
            t.getExecutedAt().toEpochMilli());
    }
}
