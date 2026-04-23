package com.prototype.priceservice.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_prices")
public class StockPrice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true)
    private String ticker;
    private BigDecimal currentPrice;
    private BigDecimal lastTradePrice;
    private BigDecimal lastTradeValue;
    private String lastTradeType;
    private LocalDateTime lastUpdatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTicker() { return ticker; }
    public void setTicker(String ticker) { this.ticker = ticker; }
    public BigDecimal getCurrentPrice() { return currentPrice; }
    public void setCurrentPrice(BigDecimal currentPrice) { this.currentPrice = currentPrice; }
    public BigDecimal getLastTradePrice() { return lastTradePrice; }
    public void setLastTradePrice(BigDecimal lastTradePrice) { this.lastTradePrice = lastTradePrice; }
    public BigDecimal getLastTradeValue() { return lastTradeValue; }
    public void setLastTradeValue(BigDecimal lastTradeValue) { this.lastTradeValue = lastTradeValue; }
    public String getLastTradeType() { return lastTradeType; }
    public void setLastTradeType(String lastTradeType) { this.lastTradeType = lastTradeType; }
    public LocalDateTime getLastUpdatedAt() { return lastUpdatedAt; }
    public void setLastUpdatedAt(LocalDateTime lastUpdatedAt) { this.lastUpdatedAt = lastUpdatedAt; }
}
