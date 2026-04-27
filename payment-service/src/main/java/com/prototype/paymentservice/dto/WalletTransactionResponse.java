package com.prototype.paymentservice.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record WalletTransactionResponse(
    Long id,
    BigDecimal amount,
    String type,
    String status,
    String paymentMethod,
    String gateway,
    String cardLast4,
    String note,
    Instant createdAt
) {}
