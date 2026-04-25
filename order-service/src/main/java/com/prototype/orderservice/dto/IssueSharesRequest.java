package com.prototype.orderservice.dto;

import java.math.BigDecimal;

public record IssueSharesRequest(Long companyUserId, String ticker, Long totalShares, BigDecimal issuePrice) {}
