package com.prototype.companyservice.model;

import jakarta.persistence.*;

@Entity
@Table(name = "company_profiles")
public class CompanyProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private Long userId;
    @Column(nullable = false)
    private String companyName;
    @Column(length = 1000)
    private String description;
    private String contactEmail;
    private String website;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
}