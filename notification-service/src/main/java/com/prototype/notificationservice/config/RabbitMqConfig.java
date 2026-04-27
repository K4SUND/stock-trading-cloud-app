package com.prototype.notificationservice.config;

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
    Queue stockListedQueue() {
        return new Queue("notification-service.stock-listed", true);
    }

    @Bean
    Queue sharesIssuedQueue() {
        return new Queue("notification-service.shares-issued", true);
    }

    @Bean
    Queue ipoPurchasedQueue() {
        return new Queue("notification-service.ipo-purchased", true);
    }

    @Bean
    Queue orderPlacedQueue() {
        return new Queue("notification-service.order-placed", true);
    }

    @Bean
    Queue tradeExecutedQueue() {
        return new Queue("notification-service.trade-executed", true);
    }

    @Bean
    Queue orderCancelledQueue() {
        return new Queue("notification-service.order-cancelled", true);
    }

    @Bean
    Binding stockListedBinding(Queue stockListedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(stockListedQueue).to(tradingExchange).with("stock-listed");
    }

    @Bean
    Binding sharesIssuedBinding(Queue sharesIssuedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(sharesIssuedQueue).to(tradingExchange).with("shares-issued");
    }

    @Bean
    Binding ipoPurchasedBinding(Queue ipoPurchasedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(ipoPurchasedQueue).to(tradingExchange).with("ipo-purchased");
    }

    @Bean
    Binding orderPlacedBinding(Queue orderPlacedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(orderPlacedQueue).to(tradingExchange).with("order-placed");
    }

    @Bean
    Binding tradeExecutedBinding(Queue tradeExecutedQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(tradeExecutedQueue).to(tradingExchange).with("trade-executed");
    }

    @Bean
    Binding orderCancelledBinding(Queue orderCancelledQueue, TopicExchange tradingExchange) {
        return BindingBuilder.bind(orderCancelledQueue).to(tradingExchange).with("order-cancelled");
    }
}

