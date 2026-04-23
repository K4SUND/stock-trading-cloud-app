package com.prototype.companyservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record StockListingRequest(@NotBlank String ticker,
                                  @NotNull @Positive BigDecimal initialPrice,
                                  @NotNull @Positive Long totalShares,
                                  String description) {}