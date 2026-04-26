package com.prototype.notificationservice.repository;

import com.prototype.notificationservice.model.CompanyStockRegistry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CompanyStockRegistryRepository extends MongoRepository<CompanyStockRegistry, String> {
    Optional<CompanyStockRegistry> findByTicker(String ticker);
}
