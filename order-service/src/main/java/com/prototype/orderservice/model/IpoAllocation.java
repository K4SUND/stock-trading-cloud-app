package com.prototype.orderservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "ipo_allocations")
public class IpoAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String ticker;

    private Long totalShares;      // total shares originally issued at IPO
    private Long remainingShares;  // shares still available for IPO purchase
    private BigDecimal ipoPrice;   // fixed price per share

    private Instant createdAt;

    @PrePersist
    void prePersist() { createdAt = Instant.now(); }

    public Long getId() { return id; }
    public String getTicker() { return ticker; }
    public void setTicker(String t) { this.ticker = t; }
    public Long getTotalShares() { return totalShares; }
    public void setTotalShares(Long s) { this.totalShares = s; }
    public Long getRemainingShares() { return remainingShares; }
    public void setRemainingShares(Long s) { this.remainingShares = s; }
    public BigDecimal getIpoPrice() { return ipoPrice; }
    public void setIpoPrice(BigDecimal p) { this.ipoPrice = p; }
    public Instant getCreatedAt() { return createdAt; }
}
