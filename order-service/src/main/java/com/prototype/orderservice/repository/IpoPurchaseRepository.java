package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.IpoPurchase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IpoPurchaseRepository extends JpaRepository<IpoPurchase, Long> {
    List<IpoPurchase> findByUserIdOrderByPurchasedAtDesc(Long userId);
}
