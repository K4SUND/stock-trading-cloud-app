package com.prototype.priceservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.priceservice.dto.StockPriceResponse;
import com.prototype.priceservice.events.OrderCompletedEvent;
import com.prototype.priceservice.model.OrderType;
import com.prototype.priceservice.model.StockPrice;
import com.prototype.priceservice.repository.StockPriceRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PriceBroadcastService {
    private static final Logger log = LoggerFactory.getLogger(PriceBroadcastService.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private final StockPriceRepository stockPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // In-memory cache: survives within the session, takes priority over DB nulls
    private final ConcurrentHashMap<String, TradeSnapshot> tradeCache = new ConcurrentHashMap<>();

    private record TradeSnapshot(BigDecimal price, BigDecimal value, String type, String timestamp) {}

    public PriceBroadcastService(StockPriceRepository stockPriceRepository,
                                  SimpMessagingTemplate messagingTemplate) {
        this.stockPriceRepository = stockPriceRepository;
        this.messagingTemplate = messagingTemplate;
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
            // Patch any existing rows that are missing lastUpdatedAt (from before this feature)
            LocalDateTime now = LocalDateTime.now();
            stockPriceRepository.findAll().stream()
                    .filter(sp -> sp.getLastUpdatedAt() == null)
                    .forEach(sp -> {
                        sp.setLastUpdatedAt(now);
                        stockPriceRepository.save(sp);
                        log.info("Patched lastUpdatedAt for ticker={}", sp.getTicker());
                    });
        }
        broadcastPrices();
    }

    @Transactional
    public StockPriceResponse createOrUpdateStock(String ticker, BigDecimal price) {
        StockPrice sp = stockPriceRepository.findByTicker(ticker.toUpperCase()).orElseGet(() -> {
            StockPrice s = new StockPrice();
            s.setTicker(ticker.toUpperCase());
            return s;
        });
        sp.setCurrentPrice(price);
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);
        log.info("Admin created/updated stock ticker={} price={}", sp.getTicker(), sp.getCurrentPrice());
        broadcastPrices();
        return buildResponse(sp);
    }

    private void create(String ticker, BigDecimal price) {
        StockPrice sp = new StockPrice();
        sp.setTicker(ticker);
        sp.setCurrentPrice(price);
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);
    }

    public List<StockPriceResponse> allPrices() {
        return stockPriceRepository.findAll().stream().map(this::buildResponse).toList();
    }

    public StockPriceResponse onePrice(String ticker) {
        return stockPriceRepository.findByTicker(ticker.toUpperCase())
                .map(this::buildResponse)
                .orElseThrow(() -> new IllegalArgumentException("Ticker not found"));
    }

    @KafkaListener(topics = "order-completed", groupId = "price-service-group")
    @Transactional
    public void onOrderCompleted(String payload) throws Exception {
        OrderCompletedEvent event = objectMapper.readValue(payload, OrderCompletedEvent.class);
        StockPrice stockPrice = stockPriceRepository.findByTicker(event.stockTicker())
                .orElseThrow(() -> new IllegalArgumentException("Ticker not found: " + event.stockTicker()));

        BigDecimal delta = BigDecimal.valueOf(event.quantity()).multiply(new BigDecimal("0.20"));
        if (event.type() == OrderType.BUY) {
            stockPrice.setCurrentPrice(stockPrice.getCurrentPrice().add(delta));
        } else {
            BigDecimal next = stockPrice.getCurrentPrice().subtract(delta);
            if (next.compareTo(new BigDecimal("1.00")) < 0) next = new BigDecimal("1.00");
            stockPrice.setCurrentPrice(next);
        }

        BigDecimal tradeValue = event.price().multiply(BigDecimal.valueOf(event.quantity()));
        LocalDateTime now = LocalDateTime.now();

        // Persist to DB
        stockPrice.setLastTradePrice(event.price());
        stockPrice.setLastTradeValue(tradeValue);
        stockPrice.setLastTradeType(event.type().name());
        stockPrice.setLastUpdatedAt(now);
        stockPriceRepository.save(stockPrice);

        // Update in-memory cache immediately (available before next DB read)
        tradeCache.put(stockPrice.getTicker(),
                new TradeSnapshot(event.price(), tradeValue, event.type().name(), now.format(FMT)));

        log.info("Updated price ticker={} newPrice={} type={} qty={}",
                stockPrice.getTicker(), stockPrice.getCurrentPrice(), event.type(), event.quantity());
        broadcastPrices();
    }

    public void broadcastPrices() {
        messagingTemplate.convertAndSend("/topic/prices", allPrices());
        log.info("Broadcasted price snapshot");
    }

    // Merges DB record with in-memory cache — cache wins for last trade fields
    private StockPriceResponse buildResponse(StockPrice sp) {
        TradeSnapshot snap = tradeCache.get(sp.getTicker());

        BigDecimal tradePrice = snap != null ? snap.price()  : sp.getLastTradePrice();
        BigDecimal tradeValue = snap != null ? snap.value()  : sp.getLastTradeValue();
        String     tradeType  = snap != null ? snap.type()   : sp.getLastTradeType();
        String     updatedAt  = snap != null ? snap.timestamp()
                : (sp.getLastUpdatedAt() != null ? sp.getLastUpdatedAt().format(FMT) : null);

        return new StockPriceResponse(
                sp.getTicker(), sp.getCurrentPrice(),
                tradePrice, tradeValue, tradeType, updatedAt);
    }
}