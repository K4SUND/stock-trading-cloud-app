package com.prototype.companyservice.repository;

import com.prototype.companyservice.model.StockListing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StockListingRepository extends JpaRepository<StockListing, Long> {
    List<StockListing> findByCompanyId(Long companyId);
    Optional<StockListing> findByTicker(String ticker);
    boolean existsByTicker(String ticker);
}