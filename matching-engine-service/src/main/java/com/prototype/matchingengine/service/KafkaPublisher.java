package com.prototype.matchingengine.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.matchingengine.events.OrderCancelledEvent;
import com.prototype.matchingengine.events.TradeExecutedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaPublisher {
    private static final Logger log = LoggerFactory.getLogger(KafkaPublisher.class);
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public KafkaPublisher(KafkaTemplate<String, String> kafka) { this.kafka = kafka; }

    public void publishTrade(TradeExecutedEvent event) { publish("trade-executed", event); }

    public void publishCancelled(OrderCancelledEvent event) { publish("order-cancelled", event); }

    private void publish(String topic, Object event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafka.send(topic, payload);
            log.debug("Published topic={} payload={}", topic, payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
