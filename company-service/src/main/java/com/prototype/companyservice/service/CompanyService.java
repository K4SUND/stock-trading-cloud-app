package com.prototype.companyservice.service;

import com.prototype.companyservice.dto.*;
import com.prototype.companyservice.model.CompanyProfile;
import com.prototype.companyservice.model.StockListing;
import com.prototype.companyservice.repository.CompanyProfileRepository;
import com.prototype.companyservice.repository.StockListingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class CompanyService {
    private static final Logger log = LoggerFactory.getLogger(CompanyService.class);

    private final CompanyProfileRepository profileRepo;
    private final StockListingRepository stockRepo;
    private final RestTemplate restTemplate;
    private final String priceServiceUrl;

    public CompanyService(CompanyProfileRepository profileRepo, StockListingRepository stockRepo,
                          RestTemplate restTemplate, @Value("${price-service.url}") String priceServiceUrl) {
        this.profileRepo = profileRepo;
        this.stockRepo = stockRepo;
        this.restTemplate = restTemplate;
        this.priceServiceUrl = priceServiceUrl;
    }

    @Transactional
    public CompanyProfileResponse saveProfile(Long userId, CompanyProfileRequest request) {
        CompanyProfile profile = profileRepo.findByUserId(userId).orElseGet(() -> {
            CompanyProfile p = new CompanyProfile();
            p.setUserId(userId);
            return p;
        });
        profile.setCompanyName(request.companyName());
        profile.setDescription(request.description());
        profile.setContactEmail(request.contactEmail());
        profile.setWebsite(request.website());
        profileRepo.save(profile);
        log.info("Saved company profile userId={} company={}", userId, profile.getCompanyName());
        return CompanyProfileResponse.from(profile);
    }

    public CompanyProfileResponse getProfile(Long userId) {
        return profileRepo.findByUserId(userId)
                .map(CompanyProfileResponse::from)
                .orElseThrow(() -> new IllegalStateException("No company profile found. Please create one first."));
    }

    public List<CompanyProfileResponse> getAllProfiles() {
        return profileRepo.findAll().stream().map(CompanyProfileResponse::from).toList();
    }

    @Transactional
    public StockListingResponse listStock(Long userId, StockListingRequest request) {
        CompanyProfile profile = profileRepo.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("Create a company profile before listing stocks."));
        if (stockRepo.existsByTicker(request.ticker().toUpperCase())) {
            throw new IllegalArgumentException("Ticker " + request.ticker().toUpperCase() + " is already listed.");
        }
        StockListing listing = new StockListing();
        listing.setTicker(request.ticker().toUpperCase());
        listing.setCompany(profile);
        listing.setInitialPrice(request.initialPrice());
        listing.setTotalShares(request.totalShares());
        listing.setDescription(request.description());
        stockRepo.save(listing);

        registerWithPriceService(listing.getTicker(), request.initialPrice());
        log.info("Listed stock ticker={} company={} price={}", listing.getTicker(), profile.getCompanyName(), request.initialPrice());
        return StockListingResponse.from(listing);
    }

    @Transactional
    public StockListingResponse updateStock(Long userId, String ticker, StockListingRequest request) {
        CompanyProfile profile = profileRepo.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("No company profile found."));
        StockListing listing = stockRepo.findByTicker(ticker.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Stock not found: " + ticker));
        if (!listing.getCompany().getId().equals(profile.getId())) {
            throw new IllegalArgumentException("You do not own this stock listing.");
        }
        listing.setInitialPrice(request.initialPrice());
        listing.setTotalShares(request.totalShares());
        listing.setDescription(request.description());
        stockRepo.save(listing);

        registerWithPriceService(listing.getTicker(), request.initialPrice());
        log.info("Updated stock ticker={} newPrice={} totalShares={}", ticker, request.initialPrice(), request.totalShares());
        return StockListingResponse.from(listing);
    }

    @Transactional(readOnly = true)
    public List<StockListingResponse> getMyStocks(Long userId) {
        CompanyProfile profile = profileRepo.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("No company profile found."));
        return stockRepo.findByCompanyId(profile.getId()).stream()
                .map(StockListingResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<StockListingResponse> getAllStocks() {
        return stockRepo.findAll().stream().map(StockListingResponse::from).toList();
    }

    private void registerWithPriceService(String ticker, java.math.BigDecimal price) {
        try {
            restTemplate.postForEntity(
                    priceServiceUrl + "/api/prices/stocks/internal",
                    Map.of("ticker", ticker, "price", price),
                    Object.class);
        } catch (Exception e) {
            log.warn("Could not notify price-service for ticker={}: {}", ticker, e.getMessage());
        }
    }
}
