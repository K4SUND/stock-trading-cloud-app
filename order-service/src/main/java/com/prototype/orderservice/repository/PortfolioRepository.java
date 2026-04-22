package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.PortfolioPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PortfolioRepository extends JpaRepository<PortfolioPosition, Long> {
    List<PortfolioPosition> findByUserId(Long userId);
    Optional<PortfolioPosition> findByUserIdAndStockTicker(Long userId, String stockTicker);
}
