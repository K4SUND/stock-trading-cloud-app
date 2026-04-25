package com.prototype.paymentservice.dto;

import java.math.BigDecimal;

public record DeductRequest(Long userId, BigDecimal amount) {}
