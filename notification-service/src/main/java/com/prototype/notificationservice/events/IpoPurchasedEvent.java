package com.prototype.notificationservice.events;

import java.math.BigDecimal;

public record IpoPurchasedEvent(
    Long userId,
    String ticker,
    int quantity,
    BigDecimal pricePerShare,
    BigDecimal totalCost
) {}
