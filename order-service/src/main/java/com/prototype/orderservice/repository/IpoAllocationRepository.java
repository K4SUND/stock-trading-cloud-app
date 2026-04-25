package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.IpoAllocation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IpoAllocationRepository extends JpaRepository<IpoAllocation, Long> {

    Optional<IpoAllocation> findByTicker(String ticker);

    List<IpoAllocation> findByRemainingSharesGreaterThan(Long min);

    // Atomic deduction — returns rows updated (0 = insufficient shares)
    @Modifying
    @Query("UPDATE IpoAllocation a SET a.remainingShares = a.remainingShares - :qty " +
           "WHERE a.ticker = :ticker AND a.remainingShares >= :qty")
    int deductShares(@Param("ticker") String ticker, @Param("qty") long qty);
}
