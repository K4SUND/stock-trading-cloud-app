package com.prototype.priceservice.dto;

import com.prototype.priceservice.model.StockPrice;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;

public record StockPriceResponse(
        String ticker,
        BigDecimal currentPrice,
        BigDecimal previousPrice,
        BigDecimal change,
        BigDecimal changePct,
        BigDecimal lastTradePrice,
        BigDecimal lastTradeValue,
        String lastUpdatedAt) {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public static StockPriceResponse from(StockPrice sp) {
        BigDecimal prev = sp.getPreviousPrice() != null ? sp.getPreviousPrice() : sp.getCurrentPrice();
        BigDecimal chg  = sp.getCurrentPrice().subtract(prev);
        BigDecimal pct  = prev.compareTo(BigDecimal.ZERO) != 0
            ? chg.divide(prev, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
            : BigDecimal.ZERO;
        return new StockPriceResponse(
                sp.getTicker(),
                sp.getCurrentPrice(),
                prev,
                chg.setScale(2, RoundingMode.HALF_UP),
                pct.setScale(2, RoundingMode.HALF_UP),
                sp.getLastTradePrice(),
                sp.getLastTradeValue(),
                sp.getLastUpdatedAt() != null ? sp.getLastUpdatedAt().format(FMT) : null);
    }
}
