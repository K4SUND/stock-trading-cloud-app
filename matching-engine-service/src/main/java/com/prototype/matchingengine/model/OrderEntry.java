package com.prototype.matchingengine.model;

import java.math.BigDecimal;

public class OrderEntry {
    public final long orderId;
    public final long userId;
    public final String ticker;
    public final String side;         // "BUY" | "SELL"
    public final BigDecimal limitPrice;
    public volatile int remainingQty;
    public final long timestamp;      // epoch millis — earlier orders have priority at same price

    public OrderEntry(long orderId, long userId, String ticker, String side,
                      BigDecimal limitPrice, int remainingQty, long timestamp) {
        this.orderId      = orderId;
        this.userId       = userId;
        this.ticker       = ticker;
        this.side         = side;
        this.limitPrice   = limitPrice;
        this.remainingQty = remainingQty;
        this.timestamp    = timestamp;
    }
}
