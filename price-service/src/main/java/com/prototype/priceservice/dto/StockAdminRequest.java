package com.prototype.priceservice.dto;

import java.math.BigDecimal;

public record StockAdminRequest(String ticker, BigDecimal price) {}