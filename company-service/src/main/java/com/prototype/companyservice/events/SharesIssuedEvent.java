package com.prototype.companyservice.events;

import java.math.BigDecimal;

public record SharesIssuedEvent(
    Long companyUserId,
    String companyName,
    String ticker,
    long additionalShares,
    BigDecimal price
) {}
