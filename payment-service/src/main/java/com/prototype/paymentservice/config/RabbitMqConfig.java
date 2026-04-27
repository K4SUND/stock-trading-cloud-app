package com.prototype.paymentservice.config;

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
    Queue paymentServiceTradeExecutedQueue() {
        return new Queue("payment-service.trade-executed", true);
    }

    @Bean
    Binding paymentServiceTradeExecutedBinding(Queue paymentServiceTradeExecutedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(paymentServiceTradeExecutedQueue).to(tradingExchange).with("trade-executed");
    }
}

