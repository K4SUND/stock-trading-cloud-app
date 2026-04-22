package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.StockOrder;

import java.math.BigDecimal;

public record OrderResponse(Long id, String stockTicker, String type, Integer quantity, BigDecimal price, String status) {
    public static OrderResponse from(StockOrder order) {
        return new OrderResponse(order.getId(), order.getStockTicker(), order.getType().name(), order.getQuantity(), order.getPrice(), order.getStatus().name());
    }
}
