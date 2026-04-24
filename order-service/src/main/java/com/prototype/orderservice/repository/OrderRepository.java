package com.prototype.orderservice.repository;

import com.prototype.orderservice.model.OrderStatus;
import com.prototype.orderservice.model.StockOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<StockOrder, Long> {
    List<StockOrder> findByUserIdOrderByIdDesc(Long userId);
    List<StockOrder> findByStatusIn(List<OrderStatus> statuses);
}
