package com.prototype.companyservice.events;

import java.math.BigDecimal;

public record StockListedEvent(
    Long companyUserId,
    String companyName,
    String ticker,
    long totalShares,
    BigDecimal ipoPrice
) {}
