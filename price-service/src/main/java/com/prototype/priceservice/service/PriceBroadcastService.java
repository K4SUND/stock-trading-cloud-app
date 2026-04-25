package com.prototype.priceservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.priceservice.dto.StockPriceResponse;
import com.prototype.priceservice.events.TradeExecutedEvent;
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

    private final StockPriceRepository  stockPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper          objectMapper = new ObjectMapper();

    private final ConcurrentHashMap<String, TradeSnapshot> tradeCache = new ConcurrentHashMap<>();

    private record TradeSnapshot(BigDecimal price, BigDecimal value, String timestamp) {}

    public PriceBroadcastService(StockPriceRepository stockPriceRepository,
                                 SimpMessagingTemplate messagingTemplate) {
        this.stockPriceRepository = stockPriceRepository;
        this.messagingTemplate    = messagingTemplate;
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
                    // Backfill previousPrice for old rows that lack it
                    if (sp.getPreviousPrice() == null) sp.setPreviousPrice(sp.getCurrentPrice());
                    stockPriceRepository.save(sp);
                });
        }
        broadcastPrices();
    }

    // ── Secondary market trade: price = execution price from matching engine ──
    // Captures previousPrice BEFORE updating so the change can be computed.
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

        // Capture previous price before overwriting — used for change calculation
        BigDecimal prevPrice = sp.getCurrentPrice() != null ? sp.getCurrentPrice() : event.price();
        sp.setPreviousPrice(prevPrice);
        sp.setCurrentPrice(event.price());
        sp.setLastTradePrice(event.price());
        sp.setLastTradeValue(event.value());
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);

        String ts = sp.getLastUpdatedAt().format(FMT);
        tradeCache.put(sp.getTicker(), new TradeSnapshot(event.price(), event.value(), ts));

        log.info("Price updated ticker={} prev={} new={} qty={}",
            sp.getTicker(), prevPrice, sp.getCurrentPrice(), event.quantity());
        broadcastPrices();
    }

    // ── Called by company-service when a stock is listed (sets initial price) ─
    @Transactional
    public StockPriceResponse createOrUpdateStock(String ticker, BigDecimal price) {
        StockPrice sp = stockPriceRepository.findByTicker(ticker.toUpperCase()).orElseGet(() -> {
            StockPrice s = new StockPrice();
            s.setTicker(ticker.toUpperCase());
            return s;
        });
        // For a newly listed stock previousPrice = currentPrice so change = 0.
        // For an existing stock (re-listing / price update), keep previous price as-is.
        if (sp.getPreviousPrice() == null) sp.setPreviousPrice(price);
        sp.setCurrentPrice(price);
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);
        broadcastPrices();
        return buildResponse(sp);
    }

    public List<StockPriceResponse> allPrices() {
        return stockPriceRepository.findAll().stream().map(this::buildResponse).toList();
    }

    public StockPriceResponse onePrice(String ticker) {
        return stockPriceRepository.findByTicker(ticker.toUpperCase())
            .map(this::buildResponse)
            .orElseThrow(() -> new IllegalArgumentException("Ticker not found: " + ticker));
    }

    public void broadcastPrices() {
        messagingTemplate.convertAndSend("/topic/prices", allPrices());
    }

    private void create(String ticker, BigDecimal price) {
        StockPrice sp = new StockPrice();
        sp.setTicker(ticker);
        sp.setCurrentPrice(price);
        sp.setPreviousPrice(price); // new seed stock: no prior price, so change = 0
        sp.setLastUpdatedAt(LocalDateTime.now());
        stockPriceRepository.save(sp);
    }

    private StockPriceResponse buildResponse(StockPrice sp) {
        TradeSnapshot snap = tradeCache.get(sp.getTicker());
        BigDecimal tradePrice = snap != null ? snap.price() : sp.getLastTradePrice();
        BigDecimal tradeValue = snap != null ? snap.value() : sp.getLastTradeValue();
        String     updatedAt  = snap != null ? snap.timestamp()
            : (sp.getLastUpdatedAt() != null ? sp.getLastUpdatedAt().format(FMT) : null);

        // Snapshot the entity into a transient response via the static factory
        // (which computes change/changePct from previousPrice), then swap the
        // trade fields with the in-memory cache values for freshness.
        StockPriceResponse base = StockPriceResponse.from(sp);
        return new StockPriceResponse(
            base.ticker(), base.currentPrice(), base.previousPrice(),
            base.change(), base.changePct(),
            tradePrice, tradeValue, updatedAt);
    }
}
