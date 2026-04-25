package com.prototype.orderservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "stock_orders")
public class StockOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String stockTicker;

    @Enumerated(EnumType.STRING)
    private OrderType type;          // BUY | SELL

    @Enumerated(EnumType.STRING)
    private OrderMode orderMode;     // LIMIT | MARKET

    private Integer quantity;        // original order quantity
    private Integer filledQuantity;  // how many shares have been matched so far

    private BigDecimal limitPrice;   // price the user specified (null for MARKET)
    private BigDecimal avgFillPrice; // weighted-average execution price (null until first fill)

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt      = Instant.now();
        filledQuantity = 0;
    }

    public int remainingQty() { return quantity - filledQuantity; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getStockTicker() { return stockTicker; }
    public void setStockTicker(String t) { this.stockTicker = t; }
    public OrderType getType() { return type; }
    public void setType(OrderType type) { this.type = type; }
    public OrderMode getOrderMode() { return orderMode; }
    public void setOrderMode(OrderMode m) { this.orderMode = m; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer qty) { this.quantity = qty; }
    public Integer getFilledQuantity() { return filledQuantity; }
    public void setFilledQuantity(Integer f) { this.filledQuantity = f; }
    public BigDecimal getLimitPrice() { return limitPrice; }
    public void setLimitPrice(BigDecimal p) { this.limitPrice = p; }
    public BigDecimal getAvgFillPrice() { return avgFillPrice; }
    public void setAvgFillPrice(BigDecimal p) { this.avgFillPrice = p; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
