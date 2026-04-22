package com.prototype.orderservice.dto;

import java.math.BigDecimal;

public record PriceLookupResponse(String ticker, BigDecimal currentPrice) {}
