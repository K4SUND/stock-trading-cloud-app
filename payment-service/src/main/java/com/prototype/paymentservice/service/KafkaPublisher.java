package com.prototype.paymentservice.service;

// Payment service no longer publishes Kafka events.
// Settlement is driven by consuming trade-executed from the matching engine.
// This class is retained as a placeholder in case future events are needed.
public class KafkaPublisher {}
