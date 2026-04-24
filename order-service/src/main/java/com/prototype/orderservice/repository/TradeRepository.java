package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TradeRepository extends JpaRepository<Trade, String> {
    List<Trade> findByTickerOrderByExecutedAtDesc(String ticker);

    @Query("SELECT t FROM Trade t WHERE t.buyerId = :uid OR t.sellerId = :uid ORDER BY t.executedAt DESC")
    List<Trade> findByUserId(@Param("uid") Long userId);

    List<Trade> findTop50ByOrderByExecutedAtDesc();
}
