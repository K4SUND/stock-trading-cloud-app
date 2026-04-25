package com.prototype.matchingengine.dto;

import java.util.List;

public record OrderBookSnapshot(String ticker, List<PriceLevel> bids, List<PriceLevel> asks) {}
