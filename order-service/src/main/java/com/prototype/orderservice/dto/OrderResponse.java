package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.StockOrder;
import java.math.BigDecimal;

public record OrderResponse(
    Long id,
    String stockTicker,
    String type,
    String orderMode,
    Integer quantity,
    Integer filledQuantity,
    BigDecimal limitPrice,
    BigDecimal avgFillPrice,
    String status,
    long createdAt
) {
    public static OrderResponse from(StockOrder o) {
        return new OrderResponse(
            o.getId(), o.getStockTicker(),
            o.getType().name(), o.getOrderMode().name(),
            o.getQuantity(), o.getFilledQuantity(),
            o.getLimitPrice(), o.getAvgFillPrice(),
            o.getStatus().name(),
            o.getCreatedAt() != null ? o.getCreatedAt().toEpochMilli() : 0L
        );
    }
}
