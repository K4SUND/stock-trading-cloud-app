package com.prototype.orderservice.config;

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
	Queue orderServiceTradeExecutedQueue() {
		return new Queue("order-service.trade-executed", true);
	}

	@Bean
	Queue orderServiceOrderCancelledQueue() {
		return new Queue("order-service.order-cancelled", true);
	}

	@Bean
	Binding orderServiceTradeExecutedBinding(Queue orderServiceTradeExecutedQueue, TopicExchange tradingExchange) {
		return BindingBuilder.bind(orderServiceTradeExecutedQueue).to(tradingExchange).with("trade-executed");
	}

	@Bean
	Binding orderServiceOrderCancelledBinding(Queue orderServiceOrderCancelledQueue, TopicExchange tradingExchange) {
		return BindingBuilder.bind(orderServiceOrderCancelledQueue).to(tradingExchange).with("order-cancelled");
	}
}

