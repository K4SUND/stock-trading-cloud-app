package com.prototype.orderservice.dto;

import com.prototype.orderservice.model.IpoAllocation;
import java.math.BigDecimal;

public record IpoAllocationResponse(
    String ticker,
    long totalShares,
    long remainingShares,
    long soldShares,
    BigDecimal ipoPrice
) {
    public static IpoAllocationResponse from(IpoAllocation a) {
        return new IpoAllocationResponse(
            a.getTicker(),
            a.getTotalShares(),
            a.getRemainingShares(),
            a.getTotalShares() - a.getRemainingShares(),
            a.getIpoPrice()
        );
    }
}
