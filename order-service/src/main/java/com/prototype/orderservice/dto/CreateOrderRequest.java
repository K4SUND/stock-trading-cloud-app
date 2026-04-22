package com.prototype.orderservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateOrderRequest(@NotBlank String stockTicker, @NotNull @Min(1) Integer quantity, @NotBlank String type) {}
