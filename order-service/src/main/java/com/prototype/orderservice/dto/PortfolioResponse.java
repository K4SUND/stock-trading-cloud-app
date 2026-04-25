package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.PortfolioPosition;
import java.math.BigDecimal;

public record PortfolioResponse(
    String stockTicker,
    Integer quantity,
    BigDecimal avgCostBasis   // weighted average purchase cost per share
) {
    public static PortfolioResponse from(PortfolioPosition p) {
        return new PortfolioResponse(p.getStockTicker(), p.getQuantity(), p.getAvgCostBasis());
    }
}
