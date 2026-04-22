package com.prototype.priceservice.repository;

import com.prototype.priceservice.model.StockPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StockPriceRepository extends JpaRepository<StockPrice, Long> {
    Optional<StockPrice> findByTicker(String ticker);
}
