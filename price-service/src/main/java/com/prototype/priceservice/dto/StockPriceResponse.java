package com.prototype.priceservice.dto;

import com.prototype.priceservice.model.StockPrice;

import java.math.BigDecimal;

public record StockPriceResponse(String ticker, BigDecimal currentPrice) {
    public static StockPriceResponse from(StockPrice stockPrice) {
        return new StockPriceResponse(stockPrice.getTicker(), stockPrice.getCurrentPrice());
    }
}
