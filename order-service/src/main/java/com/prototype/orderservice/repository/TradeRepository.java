package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.time.Instant;

public interface TradeRepository extends JpaRepository<Trade, String> {
    List<Trade> findByTickerOrderByExecutedAtDesc(String ticker);
    List<Trade> findByTickerOrderByExecutedAtAsc(String ticker);
    List<Trade> findByTickerAndExecutedAtGreaterThanEqualOrderByExecutedAtDesc(String ticker, Instant from);
    List<Trade> findByTickerAndExecutedAtGreaterThanEqualOrderByExecutedAtAsc(String ticker, Instant from);

    @Query("SELECT t FROM Trade t WHERE t.buyerId = :uid OR t.sellerId = :uid ORDER BY t.executedAt DESC")
    List<Trade> findByUserId(@Param("uid") Long userId);

    List<Trade> findTop50ByOrderByExecutedAtDesc();
}
