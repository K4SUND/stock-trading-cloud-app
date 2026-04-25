package com.prototype.orderservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.orderservice.dto.*;
import com.prototype.orderservice.events.OrderCancelledEvent;
import com.prototype.orderservice.events.OrderPlacedEvent;
import com.prototype.orderservice.events.TradeExecutedEvent;
import com.prototype.orderservice.model.*;
import com.prototype.orderservice.repository.IpoAllocationRepository;
import com.prototype.orderservice.repository.IpoPurchaseRepository;
import com.prototype.orderservice.repository.OrderRepository;
import com.prototype.orderservice.repository.PortfolioRepository;
import com.prototype.orderservice.repository.TradeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class OrderProcessingService {
    private static final Logger log = LoggerFactory.getLogger(OrderProcessingService.class);

    private final OrderRepository         orderRepository;
    private final PortfolioRepository     portfolioRepository;
    private final TradeRepository         tradeRepository;
    private final IpoAllocationRepository ipoAllocationRepository;
    private final IpoPurchaseRepository   ipoPurchaseRepository;
    private final KafkaEventPublisher     kafkaPublisher;
    private final RestTemplate            restTemplate;
    private final ObjectMapper            objectMapper = new ObjectMapper();

    @Value("${payment-service.url:http://localhost:8083}")
    private String paymentServiceUrl;

    public OrderProcessingService(OrderRepository orderRepository,
                                  PortfolioRepository portfolioRepository,
                                  TradeRepository tradeRepository,
                                  IpoAllocationRepository ipoAllocationRepository,
                                  IpoPurchaseRepository ipoPurchaseRepository,
                                  KafkaEventPublisher kafkaPublisher,
                                  RestTemplate restTemplate) {
        this.orderRepository         = orderRepository;
        this.portfolioRepository     = portfolioRepository;
        this.tradeRepository         = tradeRepository;
        this.ipoAllocationRepository = ipoAllocationRepository;
        this.ipoPurchaseRepository   = ipoPurchaseRepository;
        this.kafkaPublisher          = kafkaPublisher;
        this.restTemplate            = restTemplate;
    }

    // ── Place a secondary market order (enters matching engine) ─────────────
    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        OrderType type = OrderType.valueOf(request.type().toUpperCase());
        OrderMode mode = request.orderMode() != null
            ? OrderMode.valueOf(request.orderMode().toUpperCase()) : OrderMode.LIMIT;

        if (mode == OrderMode.LIMIT && request.limitPrice() == null) {
            throw new IllegalArgumentException("limitPrice is required for LIMIT orders");
        }

        if (type == OrderType.SELL) {
            PortfolioPosition pos = portfolioRepository
                .findByUserIdAndStockTicker(userId, request.stockTicker().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("No shares owned for " + request.stockTicker()));
            if (pos.getQuantity() < request.quantity()) {
                throw new IllegalArgumentException("Not enough shares: have " + pos.getQuantity()
                    + ", need " + request.quantity());
            }
        }

        StockOrder order = new StockOrder();
        order.setUserId(userId);
        order.setStockTicker(request.stockTicker().toUpperCase());
        order.setType(type);
        order.setOrderMode(mode);
        order.setQuantity(request.quantity());
        order.setLimitPrice(request.limitPrice());
        order.setStatus(OrderStatus.OPEN);
        order = orderRepository.save(order);

        kafkaPublisher.publishOrderPlaced(new OrderPlacedEvent(
            order.getId(), userId,
            order.getStockTicker(),
            type.name(), mode.name(),
            order.getLimitPrice(),
            order.getQuantity(),
            order.getCreatedAt().toEpochMilli()
        ));

        log.info("Order placed id={} userId={} type={} mode={} ticker={} qty={} limitPrice={}",
            order.getId(), userId, type, mode,
            order.getStockTicker(), order.getQuantity(), order.getLimitPrice());
        return OrderResponse.from(order);
    }

    // ── Direct IPO purchase (primary market — bypasses matching engine) ──────
    @Transactional
    public IpoAllocationResponse ipoBuy(Long userId, String ticker, int quantity) {
        String upper = ticker.toUpperCase();

        IpoAllocation alloc = ipoAllocationRepository.findByTicker(upper)
            .orElseThrow(() -> new IllegalArgumentException("No IPO available for " + upper));

        if (alloc.getRemainingShares() < quantity) {
            throw new IllegalArgumentException(
                "Only " + alloc.getRemainingShares() + " IPO shares remaining for " + upper);
        }

        BigDecimal totalCost = alloc.getIpoPrice().multiply(BigDecimal.valueOf(quantity));

        // Deduct wallet in payment-service before committing shares
        deductWallet(userId, totalCost);

        // Atomic share deduction — guards against concurrent buys overselling
        int updated = ipoAllocationRepository.deductShares(upper, quantity);
        if (updated == 0) {
            throw new IllegalArgumentException("Insufficient IPO shares remaining for " + upper);
        }

        // Grant shares to buyer's portfolio with cost basis at IPO price
        updatePortfolio(userId, upper, quantity, true, alloc.getIpoPrice());

        // Record the IPO purchase so it appears in "My Trades"
        IpoPurchase purchase = new IpoPurchase();
        purchase.setUserId(userId);
        purchase.setTicker(upper);
        purchase.setQuantity(quantity);
        purchase.setPricePerShare(alloc.getIpoPrice());
        purchase.setPurchasedAt(Instant.now());
        ipoPurchaseRepository.save(purchase);

        log.info("IPO purchase userId={} ticker={} qty={} price={} totalCost={}",
            userId, upper, quantity, alloc.getIpoPrice(), totalCost);

        // Re-fetch to return updated remaining count
        return IpoAllocationResponse.from(ipoAllocationRepository.findByTicker(upper).orElseThrow());
    }

    // ── Query IPO allocations ────────────────────────────────────────────────
    public List<IpoAllocationResponse> getIpoAllocations() {
        return ipoAllocationRepository.findAll()
            .stream().map(IpoAllocationResponse::from).toList();
    }

    public IpoAllocationResponse getIpoAllocation(String ticker) {
        return ipoAllocationRepository.findByTicker(ticker.toUpperCase())
            .map(IpoAllocationResponse::from)
            .orElse(null);
    }

    // ── Cancel an open secondary market order ────────────────────────────────
    @Transactional
    public void cancelOrder(Long userId, Long orderId) {
        StockOrder order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!order.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Order does not belong to you");
        }
        if (order.getStatus() != OrderStatus.OPEN && order.getStatus() != OrderStatus.PARTIALLY_FILLED) {
            throw new IllegalArgumentException("Only OPEN or PARTIALLY_FILLED orders can be cancelled");
        }
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        kafkaPublisher.publishOrderCancelled(new OrderCancelledEvent(
            orderId, order.getStockTicker(), order.remainingQty(), "USER_CANCELLED"));

        log.info("Order cancelled id={} userId={}", orderId, userId);
    }

    // ── Consume trade-executed: update portfolio + order status ──────────────
    @KafkaListener(topics = "trade-executed", groupId = "order-service-group")
    @Transactional
    public void onTradeExecuted(String payload) throws Exception {
        TradeExecutedEvent event = objectMapper.readValue(payload, TradeExecutedEvent.class);

        if (tradeRepository.existsById(event.tradeId())) {
            log.info("Duplicate trade-executed tradeId={} — skipping", event.tradeId());
            return;
        }

        Trade trade = new Trade();
        trade.setId(event.tradeId());
        trade.setTicker(event.ticker());
        trade.setBuyOrderId(event.buyOrderId());
        trade.setSellOrderId(event.sellOrderId());
        trade.setBuyerId(event.buyerId());
        trade.setSellerId(event.sellerId());
        trade.setQuantity(event.quantity());
        trade.setPrice(event.price());
        trade.setValue(event.value());
        trade.setExecutedAt(Instant.ofEpochMilli(event.timestamp()));
        tradeRepository.save(trade);

        updateOrderFill(event.buyOrderId(), event.quantity(), event.price());
        updateOrderFill(event.sellOrderId(), event.quantity(), event.price());
        // Buyer's cost basis updated with secondary market trade price
        updatePortfolio(event.buyerId(), event.ticker(), event.quantity(), true, event.price());
        // Seller's cost basis unchanged — remaining shares keep their original basis
        updatePortfolio(event.sellerId(), event.ticker(), event.quantity(), false, null);

        log.info("Trade settled tradeId={} ticker={} qty={} price={} buyer={} seller={}",
            event.tradeId(), event.ticker(), event.quantity(), event.price(),
            event.buyerId(), event.sellerId());
    }

    // ── Consume order-cancelled from matching engine ─────────────────────────
    @KafkaListener(topics = "order-cancelled", groupId = "order-service-group")
    @Transactional
    public void onOrderCancelled(String payload) throws Exception {
        OrderCancelledEvent event = objectMapper.readValue(payload, OrderCancelledEvent.class);
        orderRepository.findById(event.orderId()).ifPresent(order -> {
            if (order.getStatus() != OrderStatus.OPEN && order.getStatus() != OrderStatus.PARTIALLY_FILLED) return;
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);
            log.info("Order {} marked CANCELLED — reason={}", event.orderId(), event.reason());
        });
    }

    // ── User queries ─────────────────────────────────────────────────────────
    public List<OrderResponse> userOrders(Long userId) {
        return orderRepository.findByUserIdOrderByIdDesc(userId)
            .stream().map(OrderResponse::from).toList();
    }

    public List<PortfolioResponse> portfolio(Long userId) {
        return portfolioRepository.findByUserId(userId)
            .stream().map(PortfolioResponse::from).toList();
    }

    public List<TradeResponse> userTrades(Long userId) {
        return tradeRepository.findByUserId(userId)
            .stream().map(TradeResponse::from).toList();
    }

    public List<TradeResponse> recentMarketTrades() {
        return tradeRepository.findTop50ByOrderByExecutedAtDesc()
            .stream().map(TradeResponse::from).toList();
    }

    public List<IpoPurchaseResponse> userIpoPurchases(Long userId) {
        return ipoPurchaseRepository.findByUserIdOrderByPurchasedAtDesc(userId)
            .stream().map(IpoPurchaseResponse::from).toList();
    }

    public List<HolderResponse> holdersForTickers(List<String> tickers) {
        List<String> upper = tickers.stream().map(String::toUpperCase).toList();
        return portfolioRepository.findByStockTickerIn(upper)
            .stream().map(HolderResponse::from).toList();
    }

    // ── IPO issuance (called by company-service on stock listing) ────────────
    // Creates/updates the IPO allocation; no matching engine involvement.
    @Transactional
    public void issueShares(Long companyUserId, String ticker, Long shares, BigDecimal price) {
        String upper = ticker.toUpperCase();

        IpoAllocation alloc = ipoAllocationRepository.findByTicker(upper)
            .orElseGet(() -> {
                IpoAllocation a = new IpoAllocation();
                a.setTicker(upper);
                a.setTotalShares(0L);
                a.setRemainingShares(0L);
                return a;
            });
        alloc.setTotalShares(alloc.getTotalShares() + shares);
        alloc.setRemainingShares(alloc.getRemainingShares() + shares);
        alloc.setIpoPrice(price);
        ipoAllocationRepository.save(alloc);

        log.info("IPO allocation created/updated ticker={} shares={} price={} companyUser={}",
            upper, shares, price, companyUserId);
    }

    // ── Open orders (for matching-engine startup recovery) ───────────────────
    public List<OpenOrderView> getOpenOrders() {
        return orderRepository.findByStatusIn(
                List.of(OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED))
            .stream()
            .filter(o -> o.getOrderMode() == OrderMode.LIMIT)
            .map(OpenOrderView::from)
            .toList();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    // Synchronously deducts the IPO purchase cost from the user's wallet.
    // Throws IllegalStateException if balance is insufficient or the payment
    // service is unreachable, causing the @Transactional ipoBuy to roll back.
    private void deductWallet(Long userId, BigDecimal amount) {
        try {
            restTemplate.postForObject(
                paymentServiceUrl + "/api/payments/internal/deduct",
                Map.of("userId", userId, "amount", amount),
                Void.class
            );
        } catch (Exception e) {
            throw new IllegalStateException("Payment failed: " + e.getMessage());
        }
    }

    private void updateOrderFill(Long orderId, int fillQty, BigDecimal fillPrice) {
        orderRepository.findById(orderId).ifPresent(order -> {
            int newFilled = order.getFilledQuantity() + fillQty;
            order.setFilledQuantity(newFilled);

            BigDecimal prevAvg   = order.getAvgFillPrice() != null ? order.getAvgFillPrice() : BigDecimal.ZERO;
            int prevFilled       = newFilled - fillQty;
            BigDecimal newAvg    = prevFilled == 0
                ? fillPrice
                : (prevAvg.multiply(BigDecimal.valueOf(prevFilled))
                    .add(fillPrice.multiply(BigDecimal.valueOf(fillQty))))
                    .divide(BigDecimal.valueOf(newFilled), 4, RoundingMode.HALF_UP);
            order.setAvgFillPrice(newAvg);

            if (newFilled >= order.getQuantity()) order.setStatus(OrderStatus.FILLED);
            else                                   order.setStatus(OrderStatus.PARTIALLY_FILLED);

            orderRepository.save(order);
        });
    }

    private void updatePortfolio(Long userId, String ticker, int qty, boolean isBuy, BigDecimal price) {
        PortfolioPosition pos = portfolioRepository
            .findByUserIdAndStockTicker(userId, ticker)
            .orElseGet(() -> {
                PortfolioPosition p = new PortfolioPosition();
                p.setUserId(userId);
                p.setStockTicker(ticker);
                p.setQuantity(0);
                return p;
            });

        int prevQty = pos.getQuantity();
        int newQty  = isBuy ? prevQty + qty : prevQty - qty;

        if (newQty <= 0) {
            portfolioRepository.delete(pos);
            return;
        }

        if (isBuy && price != null) {
            // Weighted average: (prevAvg × prevQty + price × qty) / newQty
            BigDecimal prevAvg = pos.getAvgCostBasis() != null ? pos.getAvgCostBasis() : BigDecimal.ZERO;
            BigDecimal newAvg  = prevQty == 0
                ? price
                : prevAvg.multiply(BigDecimal.valueOf(prevQty))
                    .add(price.multiply(BigDecimal.valueOf(qty)))
                    .divide(BigDecimal.valueOf(newQty), 4, RoundingMode.HALF_UP);
            pos.setAvgCostBasis(newAvg);
        }
        // On sell: avgCostBasis stays unchanged (remaining shares keep their original cost)

        pos.setQuantity(newQty);
        portfolioRepository.save(pos);
    }
}
