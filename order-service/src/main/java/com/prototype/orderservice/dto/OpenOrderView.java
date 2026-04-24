package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.StockOrder;
import java.math.BigDecimal;

// Returned by the internal endpoint consumed by matching-engine on startup
public record OpenOrderView(
    Long orderId,
    Long userId,
    String ticker,
    String side,
    String mode,
    BigDecimal limitPrice,
    int remainingQty,
    long placedAt
) {
    public static OpenOrderView from(StockOrder o) {
        return new OpenOrderView(
            o.getId(), o.getUserId(),
            o.getStockTicker(),
            o.getType().name(),
            o.getOrderMode().name(),
            o.getLimitPrice(),
            o.remainingQty(),
            o.getCreatedAt().toEpochMilli()
        );
    }
}
