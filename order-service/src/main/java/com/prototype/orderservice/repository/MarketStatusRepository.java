package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.MarketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketStatusRepository extends JpaRepository<MarketStatus, Long> {}