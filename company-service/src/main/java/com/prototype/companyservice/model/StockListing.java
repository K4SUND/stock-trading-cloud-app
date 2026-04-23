package com.prototype.companyservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "stock_listings")
public class StockListing {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String ticker;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private CompanyProfile company;
    @Column(nullable = false)
    private BigDecimal initialPrice;
    @Column(nullable = false)
    private Long totalShares;
    @Column(length = 500)
    private String description;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTicker() { return ticker; }
    public void setTicker(String ticker) { this.ticker = ticker; }
    public CompanyProfile getCompany() { return company; }
    public void setCompany(CompanyProfile company) { this.company = company; }
    public BigDecimal getInitialPrice() { return initialPrice; }
    public void setInitialPrice(BigDecimal initialPrice) { this.initialPrice = initialPrice; }
    public Long getTotalShares() { return totalShares; }
    public void setTotalShares(Long totalShares) { this.totalShares = totalShares; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}