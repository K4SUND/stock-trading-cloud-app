package com.prototype.orderservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.orderservice.dto.CreateOrderRequest;
import com.prototype.orderservice.dto.HolderResponse;
import com.prototype.orderservice.dto.OrderResponse;
import com.prototype.orderservice.dto.PortfolioResponse;
import com.prototype.orderservice.dto.PriceLookupResponse;
import com.prototype.orderservice.events.OrderCompletedEvent;
import com.prototype.orderservice.events.OrderCreatedEvent;
import com.prototype.orderservice.events.PaymentResultEvent;
import com.prototype.orderservice.model.*;
import com.prototype.orderservice.repository.OrderRepository;
import com.prototype.orderservice.repository.PortfolioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
public class OrderProcessingService {
    private static final Logger log = LoggerFactory.getLogger(OrderProcessingService.class);
    private final OrderRepository orderRepository;
    private final PortfolioRepository portfolioRepository;
    private final KafkaEventPublisher kafkaEventPublisher;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String priceServiceUrl;

    public OrderProcessingService(OrderRepository orderRepository, PortfolioRepository portfolioRepository, KafkaEventPublisher kafkaEventPublisher,
                                  RestTemplate restTemplate, @Value("${price-service.url}") String priceServiceUrl) {
        this.orderRepository = orderRepository;
        this.portfolioRepository = portfolioRepository;
        this.kafkaEventPublisher = kafkaEventPublisher;
        this.restTemplate = restTemplate;
        this.priceServiceUrl = priceServiceUrl;
    }

    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        OrderType type = OrderType.valueOf(request.type().toUpperCase());
        if (type == OrderType.SELL) {
            PortfolioPosition position = portfolioRepository.findByUserIdAndStockTicker(userId, request.stockTicker())
                    .orElseThrow(() -> new IllegalArgumentException("No shares owned for this ticker"));
            if (position.getQuantity() < request.quantity()) {
                throw new IllegalArgumentException("Not enough shares to sell");
            }
        }
        ResponseEntity<PriceLookupResponse> response = restTemplate.getForEntity(priceServiceUrl + "/api/prices/stocks/" + request.stockTicker(), PriceLookupResponse.class);
        PriceLookupResponse priceInfo = response.getBody();
        if (priceInfo == null) throw new IllegalStateException("Price service unavailable");

        StockOrder order = new StockOrder();
        order.setUserId(userId);
        order.setStockTicker(request.stockTicker().toUpperCase());
        order.setQuantity(request.quantity());
        order.setType(type);
        order.setStatus(OrderStatus.PENDING);
        order.setPrice(priceInfo.currentPrice());
        order = orderRepository.save(order);
        log.info("Created order id={} userId={} type={} ticker={} qty={} price={} status=PENDING", order.getId(), userId, type, order.getStockTicker(), order.getQuantity(), order.getPrice());

        kafkaEventPublisher.publishOrderCreated(new OrderCreatedEvent(order.getId(), userId, order.getStockTicker(), order.getQuantity(), order.getPrice(), type));
        return OrderResponse.from(order);
    }

    public List<OrderResponse> userOrders(Long userId) {
        return orderRepository.findByUserIdOrderByIdDesc(userId).stream().map(OrderResponse::from).toList();
    }

    public List<PortfolioResponse> portfolio(Long userId) {
        return portfolioRepository.findByUserId(userId).stream().map(PortfolioResponse::from).toList();
    }

    public List<HolderResponse> holdersForTickers(List<String> tickers) {
        List<String> upper = tickers.stream().map(String::toUpperCase).toList();
        return portfolioRepository.findByStockTickerIn(upper).stream()
                .map(HolderResponse::from).toList();
    }

    @KafkaListener(topics = "payment-result", groupId = "order-service-group")
    @Transactional
    public void handlePaymentResult(String payload) throws Exception {
        PaymentResultEvent event = objectMapper.readValue(payload, PaymentResultEvent.class);
        StockOrder order = orderRepository.findById(event.orderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found for payment result"));
        if (order.getStatus() != OrderStatus.PENDING) {
            log.info("Ignoring duplicate payment result for orderId={} currentStatus={}", order.getId(), order.getStatus());
            return;
        }
        if (!event.success()) {
            order.setStatus(OrderStatus.FAILED);
            orderRepository.save(order);
            log.info("Order failed orderId={} reason={}", order.getId(), event.reason());
            return;
        }

        if (order.getType() == OrderType.BUY) {
            PortfolioPosition position = portfolioRepository.findByUserIdAndStockTicker(order.getUserId(), order.getStockTicker())
                    .orElseGet(() -> {
                        PortfolioPosition p = new PortfolioPosition();
                        p.setUserId(order.getUserId());
                        p.setStockTicker(order.getStockTicker());
                        p.setQuantity(0);
                        return p;
                    });
            position.setQuantity(position.getQuantity() + order.getQuantity());
            portfolioRepository.save(position);
        } else {
            PortfolioPosition position = portfolioRepository.findByUserIdAndStockTicker(order.getUserId(), order.getStockTicker())
                    .orElseThrow(() -> new IllegalArgumentException("Position missing for sell completion"));
            position.setQuantity(position.getQuantity() - order.getQuantity());
            if (position.getQuantity() <= 0) portfolioRepository.delete(position); else portfolioRepository.save(position);
        }

        order.setStatus(OrderStatus.COMPLETED);
        orderRepository.save(order);
        log.info("Order completed orderId={} userId={} type={} ticker={} qty={} price={}", order.getId(), order.getUserId(), order.getType(), order.getStockTicker(), order.getQuantity(), order.getPrice());
        kafkaEventPublisher.publishOrderCompleted(new OrderCompletedEvent(order.getId(), order.getStockTicker(), order.getQuantity(), order.getPrice(), order.getType()));
    }
}
