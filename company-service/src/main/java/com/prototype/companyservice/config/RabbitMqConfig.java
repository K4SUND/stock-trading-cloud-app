package com.prototype.companyservice.config;

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
}

