package com.prototype.notificationservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.notificationservice.events.*;
import com.prototype.notificationservice.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationConsumer {
    private static final Logger log = LoggerFactory.getLogger(NotificationConsumer.class);

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public NotificationConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    // ── Company events ────────────────────────────────────────────────────────

    @RabbitListener(queues = "notification-service.stock-listed")
    public void onStockListed(String payload) throws Exception {
        StockListedEvent event = objectMapper.readValue(payload, StockListedEvent.class);
        log.info("Notification: stock-listed ticker={} company={}", event.ticker(), event.companyName());
        notificationService.handleStockListed(event);
    }

    @RabbitListener(queues = "notification-service.shares-issued")
    public void onSharesIssued(String payload) throws Exception {
        SharesIssuedEvent event = objectMapper.readValue(payload, SharesIssuedEvent.class);
        log.info("Notification: shares-issued ticker={} additional={}", event.ticker(), event.additionalShares());
        notificationService.handleSharesIssued(event);
    }

    // ── Trader events ─────────────────────────────────────────────────────────

    @RabbitListener(queues = "notification-service.ipo-purchased")
    public void onIpoPurchased(String payload) throws Exception {
        IpoPurchasedEvent event = objectMapper.readValue(payload, IpoPurchasedEvent.class);
        log.info("Notification: ipo-purchased userId={} ticker={}", event.userId(), event.ticker());
        notificationService.handleIpoPurchased(event);
    }

    @RabbitListener(queues = "notification-service.order-placed")
    public void onOrderPlaced(String payload) throws Exception {
        OrderPlacedEvent event = objectMapper.readValue(payload, OrderPlacedEvent.class);
        log.info("Notification: order-placed orderId={} userId={}", event.orderId(), event.userId());
        notificationService.handleOrderPlaced(event);
    }

    @RabbitListener(queues = "notification-service.trade-executed")
    public void onTradeExecuted(String payload) throws Exception {
        TradeExecutedEvent event = objectMapper.readValue(payload, TradeExecutedEvent.class);
        log.info("Notification: trade-executed tradeId={} buyer={} seller={}", event.tradeId(), event.buyerId(), event.sellerId());
        notificationService.handleTradeExecuted(event);
    }

    @RabbitListener(queues = "notification-service.order-cancelled")
    public void onOrderCancelled(String payload) throws Exception {
        OrderCancelledEvent event = objectMapper.readValue(payload, OrderCancelledEvent.class);
        log.info("Notification: order-cancelled orderId={} userId={}", event.orderId(), event.userId());
        notificationService.handleOrderCancelled(event);
    }
}
