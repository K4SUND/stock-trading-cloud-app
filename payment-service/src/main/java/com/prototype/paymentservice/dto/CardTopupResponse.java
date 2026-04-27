package com.prototype.paymentservice.dto;

import java.math.BigDecimal;

public record CardTopupResponse(
    BigDecimal balance,
    String status,
    String gatewayReference,
    String message
) {}
