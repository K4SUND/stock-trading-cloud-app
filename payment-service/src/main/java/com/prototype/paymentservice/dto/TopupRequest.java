package com.prototype.paymentservice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TopupRequest(@NotNull @DecimalMin("0.01") BigDecimal amount) {}
