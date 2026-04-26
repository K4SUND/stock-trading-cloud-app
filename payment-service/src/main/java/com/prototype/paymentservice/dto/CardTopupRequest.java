package com.prototype.paymentservice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CardTopupRequest(
    @NotNull @DecimalMin("1.00") BigDecimal amount,
    @NotBlank @Size(min = 2, max = 80) String cardHolderName,
    @NotBlank String cardNumber,
    @NotBlank String expiryMonth,
    @NotBlank String expiryYear,
    @NotBlank String cvv
) {}
