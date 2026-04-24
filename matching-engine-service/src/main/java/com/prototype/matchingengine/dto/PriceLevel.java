package com.prototype.matchingengine.dto;

import java.math.BigDecimal;

public record PriceLevel(BigDecimal price, int quantity, int orders) {}
