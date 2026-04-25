package com.prototype.companyservice.service;

import com.prototype.companyservice.dto.*;
import com.prototype.companyservice.model.CompanyProfile;
import com.prototype.companyservice.model.StockListing;
import com.prototype.companyservice.repository.CompanyProfileRepository;
import com.prototype.companyservice.repository.StockListingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class CompanyService {
    private static final Logger log = LoggerFactory.getLogger(CompanyService.class);

    private final CompanyProfileRepository profileRepo;
    private final StockListingRepository   stockRepo;
    private final RestTemplate             restTemplate;
    private final String                   priceServiceUrl;
    private final String                   orderServiceUrl;

    public CompanyService(CompanyProfileRepository profileRepo, StockListingRepository stockRepo,
                          RestTemplate restTemplate,
                          @Value("${price-service.url}") String priceServiceUrl,
                          @Value("${order-service.url}") String orderServiceUrl) {
        this.profileRepo     = profileRepo;
        this.stockRepo       = stockRepo;
        this.restTemplate    = restTemplate;
        this.priceServiceUrl = priceServiceUrl;
        this.orderServiceUrl = orderServiceUrl;
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

        // Initialize market price = IPO price so the stock appears in Market Prices immediately
        initMarketPrice(listing.getTicker(), request.initialPrice());
        // Seed IPO allocation in order-service (no matching engine; direct purchase)
        issueSharesInOrderBook(userId, listing.getTicker(), request.totalShares(), request.initialPrice());

        log.info("Listed stock ticker={} company={} price={} shares={}",
            listing.getTicker(), profile.getCompanyName(), request.initialPrice(), request.totalShares());
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
        long previousShares = listing.getTotalShares();
        BigDecimal previousPrice = listing.getInitialPrice();
        listing.setInitialPrice(request.initialPrice());
        listing.setTotalShares(request.totalShares());
        listing.setDescription(request.description());
        stockRepo.save(listing);

        // Re-sync market price if IPO price changed and no secondary trading has occurred yet
        if (request.initialPrice().compareTo(previousPrice) != 0) {
            initMarketPrice(ticker.toUpperCase(), request.initialPrice());
        }

        long delta = request.totalShares() - previousShares;
        if (delta > 0) {
            issueSharesInOrderBook(userId, ticker, delta, request.initialPrice());
            log.info("Additional shares issued ticker={} delta={}", ticker, delta);
        }
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

    // Sets initial market price via price-service (initialPrice = starting market price on listing day)
    private void initMarketPrice(String ticker, BigDecimal price) {
        try {
            restTemplate.postForEntity(
                    priceServiceUrl + "/api/prices/stocks/internal",
                    Map.of("ticker", ticker, "price", price),
                    Object.class);
            log.info("Market price initialized ticker={} price={}", ticker, price);
        } catch (Exception e) {
            log.warn("Could not initialize market price for ticker={}: {}", ticker, e.getMessage());
        }
    }

    // Registers IPO allocation in order-service so traders can do direct IPO purchases
    private void issueSharesInOrderBook(Long companyUserId, String ticker,
                                        Long shares, BigDecimal price) {
        try {
            restTemplate.postForEntity(
                    orderServiceUrl + "/api/orders/internal/issue-shares",
                    Map.of("companyUserId", companyUserId, "ticker", ticker,
                           "totalShares", shares, "issuePrice", price),
                    Object.class);
            log.info("IPO allocation registered ticker={} shares={} price={}", ticker, shares, price);
        } catch (Exception e) {
            log.warn("Could not register IPO allocation for ticker={}: {}", ticker, e.getMessage());
        }
    }
}
