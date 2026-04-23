package com.prototype.companyservice.repository;

import com.prototype.companyservice.model.CompanyProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompanyProfileRepository extends JpaRepository<CompanyProfile, Long> {
    Optional<CompanyProfile> findByUserId(Long userId);
}