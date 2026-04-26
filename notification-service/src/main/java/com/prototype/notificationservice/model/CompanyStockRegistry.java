package com.prototype.notificationservice.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "company_stock_registry")
public class CompanyStockRegistry {

    @Id
    private String ticker;       // e.g. "AAPL"
    private Long companyUserId;
    private String companyName;

    public CompanyStockRegistry() {}

    public CompanyStockRegistry(String ticker, Long companyUserId, String companyName) {
        this.ticker        = ticker;
        this.companyUserId = companyUserId;
        this.companyName   = companyName;
    }

    public String getTicker()        { return ticker; }
    public Long getCompanyUserId()   { return companyUserId; }
    public String getCompanyName()   { return companyName; }
}
