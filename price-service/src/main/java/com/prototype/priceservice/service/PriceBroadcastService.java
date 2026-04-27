package com.prototype.priceservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.priceservice.dto.StockPriceResponse;
import com.prototype.priceservice.events.TradeExecutedEvent;
import com.prototype.priceservice.model.StockPrice;
import com.prototype.priceservice.repository.StockPriceRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PriceBroadcastService {
    private static final Logger log = LoggerFactory.getLogger(PriceBroadcastService.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private static final String CACHE_ALL    = "prices:all";
    private static final String CACHE_PREFIX = "price:";
    private static final Duration CACHE_TTL  = Duration.ofMinutes(5);

    private final StockPriceRepository  stockPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate   redisTemplate;
    private final ObjectMapper          objectMapper = new ObjectMapper();

    private final ConcurrentHashMap<String, TradeSnapshot> tradeCache = new ConcurrentHashMap<>();

    private record TradeSnapshot(BigDecimal price, BigDecimal value, String timestamp) {}

    public PriceBroadcastService(StockPriceRepository stockPriceRepository,
                                 SimpMessagingTemplate messagingTemplate,
                                 StringRedisTemplate redisTemplate) {
        this.stockPriceRepository = stockPriceRepository;
        this.messagingTemplate    = messagingTemplate;
        this.redisTemplate        = redisTemplate;
    }

    @PostConstruct
    @Transactional
    public void seedData() {
        if (stockPriceRepository.count() == 0) {
            create("ABC", new BigDecimal("100.00"));
            create("XYZ", new BigDecimal("250.00"));
            create("QRS", new BigDecimal("75.00"));
            log.info("Seeded initial stock prices");
        } else {
            LocalDateTime now = LocalDateTime.now();
            stockPriceRepository.findAll().stream()
                .filter(sp -> sp.getLastUpdatedAt() == null)
                .forEach(sp -> {
                    sp.setLastUpdatedAt(now);
                    if (sp.getPreviousPrice() == null) sp.setPreviousPrice(sp.getCurrentPrice());
                    stockPriceRepository.save(sp);
                });
        }
        broadcastPrices();
    }

    @KafkaListener(topics = "trade-executed", groupId = "price-service-group")
    @Transactional
    public void onTradeExecuted(String payload) throws Exception {
        TradeExecutedEvent event = objectMapper.readValue(payload, TradeExecutedEvent.class);

        StockPrice sp = stockPriceRepository.findByTicker(event.ticker())
            .orElseGet(() -> {
                StockPrice s = new StockPrice();
                s.setTicker(event.ticker().toUpperCase());
                return s;
            });

        BigDecimal prevPrice = sp.getCurrentPrice() != null ? sp.getCurrentPrice() : event.price();
        sp.setPreviousPrice(prevPrice);
        sp.setCurrentPrice(event.price());
        sp.setLastTradePrice(event.price());
        sp.setLastTradeValue(event.value());
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);

        String ts = sp.getLastUpdatedAt().format(FMT);
        tradeCache.put(sp.getTicker(), new TradeSnapshot(event.price(), event.value(), ts));

        StockPriceResponse response = buildResponse(sp);
        cacheSinglePrice(response);
        evictAllCache();

        log.info("Price updated ticker={} prev={} new={} qty={}",
            sp.getTicker(), prevPrice, sp.getCurrentPrice(), event.quantity());
        broadcastPrices();
    }

    @Transactional
    public StockPriceResponse createOrUpdateStock(String ticker, BigDecimal price) {
        StockPrice sp = stockPriceRepository.findByTicker(ticker.toUpperCase()).orElseGet(() -> {
            StockPrice s = new StockPrice();
            s.setTicker(ticker.toUpperCase());
            return s;
        });
        if (sp.getPreviousPrice() == null) sp.setPreviousPrice(price);
        sp.setCurrentPrice(price);
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);

        StockPriceResponse response = buildResponse(sp);
        cacheSinglePrice(response);
        evictAllCache();

        broadcastPrices();
        return response;
    }

    public List<StockPriceResponse> allPrices() {
        try {
            String cached = redisTemplate.opsForValue().get(CACHE_ALL);
            if (cached != null) {
                log.debug("Cache hit: {}", CACHE_ALL);
                return objectMapper.readValue(cached, new TypeReference<List<StockPriceResponse>>() {});
            }
        } catch (Exception e) {
            log.warn("Redis read failed for all prices, falling back to DB: {}", e.getMessage());
        }

        List<StockPriceResponse> prices = stockPriceRepository.findAll()
            .stream().map(this::buildResponse).toList();
        cacheAllPrices(prices);
        return prices;
    }

    public StockPriceResponse onePrice(String ticker) {
        String upper = ticker.toUpperCase();
        try {
            String cached = redisTemplate.opsForValue().get(CACHE_PREFIX + upper);
            if (cached != null) {
                log.debug("Cache hit: {}{}", CACHE_PREFIX, upper);
                return objectMapper.readValue(cached, StockPriceResponse.class);
            }
        } catch (Exception e) {
            log.warn("Redis read failed for ticker {}, falling back to DB: {}", upper, e.getMessage());
        }

        StockPriceResponse response = stockPriceRepository.findByTicker(upper)
            .map(this::buildResponse)
            .orElseThrow(() -> new IllegalArgumentException("Ticker not found: " + ticker));
        cacheSinglePrice(response);
        return response;
    }

    public void broadcastPrices() {
        messagingTemplate.convertAndSend("/topic/prices", allPrices());
    }

    // ── Cache helpers ─────────────────────────────────────────────────────────

    private void cacheSinglePrice(StockPriceResponse r) {
        try {
            redisTemplate.opsForValue().set(
                CACHE_PREFIX + r.ticker(),
                objectMapper.writeValueAsString(r),
                CACHE_TTL);
        } catch (Exception e) {
            log.warn("Redis write failed for ticker {}: {}", r.ticker(), e.getMessage());
        }
    }

    private void cacheAllPrices(List<StockPriceResponse> prices) {
        try {
            redisTemplate.opsForValue().set(
                CACHE_ALL,
                objectMapper.writeValueAsString(prices),
                CACHE_TTL);
        } catch (Exception e) {
            log.warn("Redis write failed for all prices: {}", e.getMessage());
        }
    }

    private void evictAllCache() {
        try {
            redisTemplate.delete(CACHE_ALL);
        } catch (Exception e) {
            log.warn("Redis evict failed for {}: {}", CACHE_ALL, e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void create(String ticker, BigDecimal price) {
        StockPrice sp = new StockPrice();
        sp.setTicker(ticker);
        sp.setCurrentPrice(price);
        sp.setPreviousPrice(price);
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);
    }

    private StockPriceResponse buildResponse(StockPrice sp) {
        TradeSnapshot snap = tradeCache.get(sp.getTicker());
        BigDecimal tradePrice = snap != null ? snap.price() : sp.getLastTradePrice();
        BigDecimal tradeValue = snap != null ? snap.value() : sp.getLastTradeValue();
        String     updatedAt  = snap != null ? snap.timestamp()
            : (sp.getLastUpdatedAt() != null ? sp.getLastUpdatedAt().format(FMT) : null);

        StockPriceResponse base = StockPriceResponse.from(sp);
        return new StockPriceResponse(
            base.ticker(), base.currentPrice(), base.previousPrice(),
            base.change(), base.changePct(),
            tradePrice, tradeValue, updatedAt);
    }
}