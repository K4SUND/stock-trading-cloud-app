package com.prototype.companyservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.companyservice.events.SharesIssuedEvent;
import com.prototype.companyservice.events.StockListedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public KafkaEventPublisher(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishStockListed(StockListedEvent event)   { publish("stock-listed", event); }
    public void publishSharesIssued(SharesIssuedEvent event) { publish("shares-issued", event); }

    private void publish(String topic, Object event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, payload);
            log.info("Published topic={} payload={}", topic, payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
