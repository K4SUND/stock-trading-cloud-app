package com.prototype.paymentservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.paymentservice.dto.CardTopupRequest;
import com.prototype.paymentservice.dto.CardTopupResponse;
import com.prototype.paymentservice.dto.TopupRequest;
import com.prototype.paymentservice.dto.WalletResponse;
import com.prototype.paymentservice.dto.WalletTransactionResponse;
import com.prototype.paymentservice.events.TradeExecutedEvent;
import com.prototype.paymentservice.model.Wallet;
import com.prototype.paymentservice.model.WalletTransaction;
import com.prototype.paymentservice.repository.WalletRepository;
import com.prototype.paymentservice.repository.WalletTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class WalletService {
    private static final Logger log = LoggerFactory.getLogger(WalletService.class);

    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final SandboxCardGatewayService sandboxCardGatewayService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WalletService(
        WalletRepository walletRepository,
        WalletTransactionRepository walletTransactionRepository,
        SandboxCardGatewayService sandboxCardGatewayService
    ) {
        this.walletRepository = walletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.sandboxCardGatewayService = sandboxCardGatewayService;
    }

    @Transactional
    public WalletResponse topup(Long userId, TopupRequest request) {
        Wallet wallet = getOrCreate(userId);
        wallet.setBalance(wallet.getBalance().add(request.amount()));
        walletRepository.save(wallet);
        walletTransactionRepository.save(buildTransaction(
            userId,
            request.amount(),
            "TOPUP",
            "SUCCESS",
            "MANUAL",
            "INTERNAL",
            null,
            null,
            "Manual wallet top-up"
        ));
        log.info("Wallet topup userId={} amount={} newBalance={}", userId, request.amount(), wallet.getBalance());
        return new WalletResponse(wallet.getBalance());
    }

    @Transactional(noRollbackFor = IllegalStateException.class)
    public CardTopupResponse topupBySandboxCard(Long userId, CardTopupRequest request) {
        Wallet wallet = getOrCreate(userId);
        SandboxCardGatewayService.CardPaymentResult result = sandboxCardGatewayService.charge(request);

        walletTransactionRepository.save(buildTransaction(
            userId,
            request.amount(),
            "TOPUP",
            result.approved() ? "SUCCESS" : "FAILED",
            "CARD",
            "SANDBOX",
            result.gatewayReference(),
            result.cardLast4(),
            result.message()
        ));

        if (!result.approved()) {
            throw new IllegalStateException(result.message());
        }

        wallet.setBalance(wallet.getBalance().add(request.amount()));
        walletRepository.save(wallet);
        log.info(
            "Sandbox card topup userId={} amount={} reference={} newBalance={}",
            userId,
            request.amount(),
            result.gatewayReference(),
            wallet.getBalance()
        );

        return new CardTopupResponse(
            wallet.getBalance(),
            "SUCCESS",
            result.gatewayReference(),
            "Card payment approved in sandbox and funds added to wallet."
        );
    }

    public WalletResponse getWallet(Long userId) {
        return new WalletResponse(getOrCreate(userId).getBalance());
    }

    public List<WalletTransactionResponse> getRecentTransactions(Long userId) {
        return walletTransactionRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(t -> new WalletTransactionResponse(
                t.getId(),
                t.getAmount(),
                t.getType(),
                t.getStatus(),
                t.getPaymentMethod(),
                t.getGateway(),
                t.getCardLast4(),
                t.getNote(),
                t.getCreatedAt()
            ))
            .toList();
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

    private WalletTransaction buildTransaction(
        Long userId,
        BigDecimal amount,
        String type,
        String status,
        String paymentMethod,
        String gateway,
        String gatewayReference,
        String cardLast4,
        String note
    ) {
        WalletTransaction tx = new WalletTransaction();
        tx.setUserId(userId);
        tx.setAmount(amount);
        tx.setType(type);
        tx.setStatus(status);
        tx.setPaymentMethod(paymentMethod);
        tx.setGateway(gateway);
        tx.setGatewayReference(gatewayReference);
        tx.setCardLast4(cardLast4);
        tx.setNote(note);
        return tx;
    }
}
