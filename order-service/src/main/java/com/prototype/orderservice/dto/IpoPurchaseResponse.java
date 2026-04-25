package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.IpoPurchase;

import java.math.BigDecimal;

public record IpoPurchaseResponse(
    Long id,
    String ticker,
    int quantity,
    BigDecimal pricePerShare,
    BigDecimal totalValue,
    long purchasedAt
) {
    public static IpoPurchaseResponse from(IpoPurchase p) {
        return new IpoPurchaseResponse(
            p.getId(),
            p.getTicker(),
            p.getQuantity(),
            p.getPricePerShare(),
            p.getPricePerShare().multiply(BigDecimal.valueOf(p.getQuantity())),
            p.getPurchasedAt().toEpochMilli()
        );
    }
}
