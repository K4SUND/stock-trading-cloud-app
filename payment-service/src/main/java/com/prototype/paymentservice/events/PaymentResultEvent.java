package com.prototype.paymentservice.events;

public record PaymentResultEvent(Long orderId, boolean success, String reason) {}
