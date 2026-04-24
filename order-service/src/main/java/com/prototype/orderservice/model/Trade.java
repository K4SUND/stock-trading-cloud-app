package com.prototype.orderservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "trades")
public class Trade {
    @Id
    private String id; // UUID from matching engine — guarantees idempotency

    private String  ticker;
    private Long    buyOrderId;
    private Long    sellOrderId;
    private Long    buyerId;
    private Long    sellerId;
    private Integer quantity;
    private BigDecimal price;
    private BigDecimal value;
    private Instant executedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTicker() { return ticker; }
    public void setTicker(String ticker) { this.ticker = ticker; }
    public Long getBuyOrderId() { return buyOrderId; }
    public void setBuyOrderId(Long b) { this.buyOrderId = b; }
    public Long getSellOrderId() { return sellOrderId; }
    public void setSellOrderId(Long s) { this.sellOrderId = s; }
    public Long getBuyerId() { return buyerId; }
    public void setBuyerId(Long b) { this.buyerId = b; }
    public Long getSellerId() { return sellerId; }
    public void setSellerId(Long s) { this.sellerId = s; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer q) { this.quantity = q; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal p) { this.price = p; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal v) { this.value = v; }
    public Instant getExecutedAt() { return executedAt; }
    public void setExecutedAt(Instant t) { this.executedAt = t; }
}
