package com.prototype.companyservice.dto;

import jakarta.validation.constraints.NotBlank;

public record CompanyProfileRequest(@NotBlank String companyName, String description,
                                    String contactEmail, String website) {}