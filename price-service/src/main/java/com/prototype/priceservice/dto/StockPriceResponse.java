package com.prototype.priceservice.dto;

import com.prototype.priceservice.model.StockPrice;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

public record StockPriceResponse(
        String ticker,
        BigDecimal currentPrice,
        BigDecimal lastTradePrice,
        BigDecimal lastTradeValue,
        String lastTradeType,
        String lastUpdatedAt) {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public static StockPriceResponse from(StockPrice sp) {
        return new StockPriceResponse(
                sp.getTicker(),
                sp.getCurrentPrice(),
                sp.getLastTradePrice(),
                sp.getLastTradeValue(),
                sp.getLastTradeType(),
                sp.getLastUpdatedAt() != null ? sp.getLastUpdatedAt().format(FMT) : null);
    }
}