package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.PortfolioPosition;

public record HolderResponse(Long userId, String stockTicker, Integer quantity) {
    public static HolderResponse from(PortfolioPosition p) {
        return new HolderResponse(p.getUserId(), p.getStockTicker(), p.getQuantity());
    }
}
