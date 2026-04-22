package com.prototype.orderservice.events;

public record PaymentResultEvent(Long orderId, boolean success, String reason) {}
