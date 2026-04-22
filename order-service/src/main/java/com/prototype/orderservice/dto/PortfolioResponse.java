package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.PortfolioPosition;

public record PortfolioResponse(String stockTicker, Integer quantity) {
    public static PortfolioResponse from(PortfolioPosition position) {
        return new PortfolioResponse(position.getStockTicker(), position.getQuantity());
    }
}
