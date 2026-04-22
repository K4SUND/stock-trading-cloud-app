package com.prototype.paymentservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.paymentservice.dto.TopupRequest;
import com.prototype.paymentservice.dto.WalletResponse;
import com.prototype.paymentservice.events.OrderCreatedEvent;
import com.prototype.paymentservice.events.PaymentResultEvent;
import com.prototype.paymentservice.model.OrderType;
import com.prototype.paymentservice.model.Wallet;
import com.prototype.paymentservice.repository.WalletRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class WalletService {
    private static final Logger log = LoggerFactory.getLogger(WalletService.class);
    private final WalletRepository walletRepository;
    private final KafkaPublisher kafkaPublisher;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WalletService(WalletRepository walletRepository, KafkaPublisher kafkaPublisher) {
        this.walletRepository = walletRepository;
        this.kafkaPublisher = kafkaPublisher;
    }

    @Transactional
    public WalletResponse topup(Long userId, TopupRequest request) {
        Wallet wallet = walletRepository.findByUserId(userId).orElseGet(() -> {
            Wallet w = new Wallet();
            w.setUserId(userId);
            w.setBalance(BigDecimal.ZERO);
            return w;
        });
        wallet.setBalance(wallet.getBalance().add(request.amount()));
        walletRepository.save(wallet);
        log.info("Wallet topup userId={} amount={} newBalance={}", userId, request.amount(), wallet.getBalance());
        return new WalletResponse(wallet.getBalance());
    }

    public WalletResponse getWallet(Long userId) {
        Wallet wallet = walletRepository.findByUserId(userId).orElseGet(() -> {
            Wallet w = new Wallet();
            w.setUserId(userId);
            w.setBalance(BigDecimal.ZERO);
            return walletRepository.save(w);
        });
        return new WalletResponse(wallet.getBalance());
    }

    @KafkaListener(topics = "order-created", groupId = "payment-service-group")
    @Transactional
    public void processOrder(String payload) throws Exception {
        OrderCreatedEvent event = objectMapper.readValue(payload, OrderCreatedEvent.class);
        Wallet wallet = walletRepository.findByUserId(event.userId()).orElseGet(() -> {
            Wallet w = new Wallet();
            w.setUserId(event.userId());
            w.setBalance(BigDecimal.ZERO);
            return walletRepository.save(w);
        });
        BigDecimal amount = event.price().multiply(BigDecimal.valueOf(event.quantity()));

        if (event.type() == OrderType.BUY) {
            if (wallet.getBalance().compareTo(amount) < 0) {
                log.info("Payment failed orderId={} userId={} reason=INSUFFICIENT_FUNDS", event.orderId(), event.userId());
                kafkaPublisher.publishPaymentResult(new PaymentResultEvent(event.orderId(), false, "INSUFFICIENT_FUNDS"));
                return;
            }
            wallet.setBalance(wallet.getBalance().subtract(amount));
            walletRepository.save(wallet);
            log.info("BUY payment success orderId={} userId={} debited={} newBalance={}", event.orderId(), event.userId(), amount, wallet.getBalance());
        } else {
            wallet.setBalance(wallet.getBalance().add(amount));
            walletRepository.save(wallet);
            log.info("SELL payment success orderId={} userId={} credited={} newBalance={}", event.orderId(), event.userId(), amount, wallet.getBalance());
        }
        kafkaPublisher.publishPaymentResult(new PaymentResultEvent(event.orderId(), true, "SUCCESS"));
    }
}
