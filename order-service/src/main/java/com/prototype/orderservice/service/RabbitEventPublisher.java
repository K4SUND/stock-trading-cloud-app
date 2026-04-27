package com.prototype.orderservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.orderservice.events.IpoPurchasedEvent;
import com.prototype.orderservice.events.OrderCancelledEvent;
import com.prototype.orderservice.events.OrderPlacedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class RabbitEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(RabbitEventPublisher.class);
    private static final String EXCHANGE = "trading.events";

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RabbitEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishOrderPlaced(OrderPlacedEvent event)       { publish("order-placed", event); }
    public void publishOrderCancelled(OrderCancelledEvent event) { publish("order-cancelled", event); }
    public void publishIpoPurchased(IpoPurchasedEvent event)     { publish("ipo-purchased", event); }

    private void publish(String routingKey, Object event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            rabbitTemplate.convertAndSend(EXCHANGE, routingKey, payload);
            log.info("Published routingKey={} payload={}", routingKey, payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}

