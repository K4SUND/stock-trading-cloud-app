package com.prototype.matchingengine.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {
    public static final String EXCHANGE = "trading.events";

    @Bean
    TopicExchange tradingExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue matchingEngineOrderPlacedQueue() {
        return new Queue("matching-engine.order-placed", true);
    }

    @Bean
    Queue matchingEngineOrderCancelledQueue() {
        return new Queue("matching-engine.order-cancelled", true);
    }

    @Bean
    Binding matchingEngineOrderPlacedBinding(Queue matchingEngineOrderPlacedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(matchingEngineOrderPlacedQueue).to(tradingExchange).with("order-placed");
    }

    @Bean
    Binding matchingEngineOrderCancelledBinding(Queue matchingEngineOrderCancelledQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(matchingEngineOrderCancelledQueue).to(tradingExchange).with("order-cancelled");
    }
}

