package com.prototype.paymentservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.paymentservice.dto.TopupRequest;
import com.prototype.paymentservice.dto.WalletResponse;
import com.prototype.paymentservice.events.TradeExecutedEvent;
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
    private final ObjectMapper     objectMapper = new ObjectMapper();

    public WalletService(WalletRepository walletRepository) {
        this.walletRepository = walletRepository;
    }

    @Transactional
    public WalletResponse topup(Long userId, TopupRequest request) {
        Wallet wallet = getOrCreate(userId);
        wallet.setBalance(wallet.getBalance().add(request.amount()));
        walletRepository.save(wallet);
        log.info("Wallet topup userId={} amount={} newBalance={}", userId, request.amount(), wallet.getBalance());
        return new WalletResponse(wallet.getBalance());
    }

    public WalletResponse getWallet(Long userId) {
        return new WalletResponse(getOrCreate(userId).getBalance());
    }

    // ── IPO purchase: deduct cost from buyer's wallet (called synchronously) ──
    @Transactional
    public void deduct(Long userId, BigDecimal amount) {
        Wallet wallet = getOrCreate(userId);
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new IllegalStateException(
                "Insufficient balance for IPO purchase: have " + wallet.getBalance() + ", need " + amount);
        }
        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);
        log.info("IPO debit userId={} amount={} newBalance={}", userId, amount, wallet.getBalance());
    }

    // ── Trade settlement: money moves buyer → seller ─────────────────────────
    @KafkaListener(topics = "trade-executed", groupId = "payment-service-group")
    @Transactional
    public void onTradeExecuted(String payload) throws Exception {
        TradeExecutedEvent event = objectMapper.readValue(payload, TradeExecutedEvent.class);
        BigDecimal amount = event.value(); // price × quantity

        Wallet buyerWallet  = getOrCreate(event.buyerId());
        Wallet sellerWallet = getOrCreate(event.sellerId());

        if (buyerWallet.getBalance().compareTo(amount) < 0) {
            // Insufficient funds — log and skip (order-service will see portfolio inconsistency)
            // In production this would trigger a saga rollback
            log.error("SETTLEMENT FAILED tradeId={} buyerId={} required={} available={}",
                event.tradeId(), event.buyerId(), amount, buyerWallet.getBalance());
            return;
        }

        buyerWallet.setBalance(buyerWallet.getBalance().subtract(amount));
        sellerWallet.setBalance(sellerWallet.getBalance().add(amount));
        walletRepository.save(buyerWallet);
        walletRepository.save(sellerWallet);

        log.info("Settlement tradeId={} ticker={} qty={} price={} buyer={} debited={} seller={} credited={}",
            event.tradeId(), event.ticker(), event.quantity(), event.price(),
            event.buyerId(), amount, event.sellerId(), amount);
    }

    private Wallet getOrCreate(Long userId) {
        return walletRepository.findByUserId(userId).orElseGet(() -> {
            Wallet w = new Wallet();
            w.setUserId(userId);
            w.setBalance(BigDecimal.ZERO);
            return walletRepository.save(w);
        });
    }
}
