package com.prototype.orderservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateOrderRequest(
    @NotBlank String stockTicker,
    @NotNull @Min(1) Integer quantity,
    @NotBlank String type,          // "BUY" | "SELL"
    String orderMode,               // "LIMIT" | "MARKET" — defaults to "LIMIT"
    BigDecimal limitPrice           // required for LIMIT, ignored for MARKET
) {}
