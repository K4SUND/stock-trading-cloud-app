package com.prototype.priceservice.events;

import java.math.BigDecimal;

public record PriceUpdatedEvent(String ticker, BigDecimal currentPrice) {}
