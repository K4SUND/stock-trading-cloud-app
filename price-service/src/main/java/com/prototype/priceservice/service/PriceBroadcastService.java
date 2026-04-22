package com.prototype.priceservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.priceservice.dto.StockPriceResponse;
import com.prototype.priceservice.events.OrderCompletedEvent;
import com.prototype.priceservice.events.PriceUpdatedEvent;
import com.prototype.priceservice.model.OrderType;
import com.prototype.priceservice.model.StockPrice;
import com.prototype.priceservice.repository.StockPriceRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class PriceBroadcastService {
    private static final Logger log = LoggerFactory.getLogger(PriceBroadcastService.class);
    private final StockPriceRepository stockPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PriceBroadcastService(StockPriceRepository stockPriceRepository,
                                  SimpMessagingTemplate messagingTemplate,
                                  KafkaTemplate<String, String> kafkaTemplate) {
        this.stockPriceRepository = stockPriceRepository;
        this.messagingTemplate = messagingTemplate;
        this.kafkaTemplate = kafkaTemplate;
    }

    @PostConstruct
    @Transactional
    public void seedData() {
        if (stockPriceRepository.count() == 0) {
            create("ABC", new BigDecimal("100.00"));
            create("XYZ", new BigDecimal("250.00"));
            create("QRS", new BigDecimal("75.00"));
            broadcastPrices();
            log.info("Seeded initial stock prices");
        }
    }

    @Transactional
    public StockPriceResponse createOrUpdateStock(String ticker, BigDecimal price) {
        StockPrice sp = stockPriceRepository.findByTicker(ticker.toUpperCase()).orElseGet(() -> {
            StockPrice s = new StockPrice();
            s.setTicker(ticker.toUpperCase());
            return s;
        });
        sp.setCurrentPrice(price);
        stockPriceRepository.save(sp);
        log.info("Admin created/updated stock ticker={} price={}", sp.getTicker(), sp.getCurrentPrice());
        broadcastPrices();
        return StockPriceResponse.from(sp);
    }

    private void create(String ticker, BigDecimal price) {
        StockPrice sp = new StockPrice();
        sp.setTicker(ticker);
        sp.setCurrentPrice(price);
        stockPriceRepository.save(sp);
    }

    public List<StockPriceResponse> allPrices() {
        return stockPriceRepository.findAll().stream().map(StockPriceResponse::from).toList();
    }

    public StockPriceResponse onePrice(String ticker) {
        return stockPriceRepository.findByTicker(ticker.toUpperCase()).map(StockPriceResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("Ticker not found"));
    }

    @KafkaListener(topics = "order-completed", groupId = "price-service-group")
    @Transactional
    public void onOrderCompleted(String payload) throws Exception {
        OrderCompletedEvent event = objectMapper.readValue(payload, OrderCompletedEvent.class);
        StockPrice stockPrice = stockPriceRepository.findByTicker(event.stockTicker())
                .orElseThrow(() -> new IllegalArgumentException("Ticker not found"));
        BigDecimal delta = BigDecimal.valueOf(event.quantity()).multiply(new BigDecimal("0.20"));
        if (event.type() == OrderType.BUY) {
            stockPrice.setCurrentPrice(stockPrice.getCurrentPrice().add(delta));
        } else {
            BigDecimal next = stockPrice.getCurrentPrice().subtract(delta);
            if (next.compareTo(new BigDecimal("1.00")) < 0) next = new BigDecimal("1.00");
            stockPrice.setCurrentPrice(next);
        }
        stockPriceRepository.save(stockPrice);
        log.info("Updated price ticker={} newPrice={} reason={} qty={}", stockPrice.getTicker(), stockPrice.getCurrentPrice(), event.type(), event.quantity());
        broadcastPrices();
    }

    public void broadcastPrices() {
        messagingTemplate.convertAndSend("/topic/prices", allPrices());
        log.info("Broadcasted price snapshot");
    }
}
