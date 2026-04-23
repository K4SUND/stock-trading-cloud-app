package com.prototype.companyservice.dto;

import com.prototype.companyservice.model.CompanyProfile;

public record CompanyProfileResponse(Long id, Long userId, String companyName,
                                     String description, String contactEmail, String website) {
    public static CompanyProfileResponse from(CompanyProfile p) {
        return new CompanyProfileResponse(p.getId(), p.getUserId(), p.getCompanyName(),
                p.getDescription(), p.getContactEmail(), p.getWebsite());
    }
}