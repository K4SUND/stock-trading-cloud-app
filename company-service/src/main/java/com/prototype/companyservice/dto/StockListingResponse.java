package com.prototype.companyservice.dto;

import com.prototype.companyservice.model.StockListing;
import java.math.BigDecimal;

public record StockListingResponse(Long id, String ticker, String companyName,
                                   BigDecimal initialPrice, Long totalShares, String description) {
    public static StockListingResponse from(StockListing s) {
        return new StockListingResponse(s.getId(), s.getTicker(),
                s.getCompany().getCompanyName(), s.getInitialPrice(),
                s.getTotalShares(), s.getDescription());
    }
}