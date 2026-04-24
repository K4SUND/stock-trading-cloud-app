package com.prototype.orderservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "portfolio_positions", uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "stockTicker"}))
public class PortfolioPosition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String stockTicker;
    private Integer quantity;

    // Weighted average cost basis — updated on every buy (IPO or secondary trade).
    // Stays the same when selling (cost basis of remaining shares doesn't change).
    private BigDecimal avgCostBasis;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getStockTicker() { return stockTicker; }
    public void setStockTicker(String stockTicker) { this.stockTicker = stockTicker; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getAvgCostBasis() { return avgCostBasis; }
    public void setAvgCostBasis(BigDecimal avgCostBasis) { this.avgCostBasis = avgCostBasis; }
}
