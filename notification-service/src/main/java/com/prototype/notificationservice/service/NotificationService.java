package com.prototype.notificationservice.service;

import com.prototype.notificationservice.events.*;
import com.prototype.notificationservice.model.CompanyStockRegistry;
import com.prototype.notificationservice.model.Notification;
import com.prototype.notificationservice.repository.CompanyStockRegistryRepository;
import com.prototype.notificationservice.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class NotificationService {

    private final NotificationRepository          repository;
    private final CompanyStockRegistryRepository  registryRepo;

    public NotificationService(NotificationRepository repository,
                               CompanyStockRegistryRepository registryRepo) {
        this.repository   = repository;
        this.registryRepo = registryRepo;
    }

    // ── Company events ────────────────────────────────────────────────────────

    public void handleStockListed(StockListedEvent event) {
        // Register ticker → company mapping for future lookups
        registryRepo.save(new CompanyStockRegistry(
            event.ticker(), event.companyUserId(), event.companyName()));

        // Company: personal success notification
        repository.save(new Notification(
            event.companyUserId(),
            "STOCK_LISTED",
            "Stock Listed Successfully",
            "Your stock " + event.ticker() + " is now live at $" + event.ipoPrice()
                + " with " + event.totalShares() + " IPO shares available."
        ));

        // Broadcast: all users see the new IPO opportunity
        repository.save(Notification.broadcast(
            "STOCK_LISTED",
            "New IPO: " + event.ticker(),
            event.companyName() + " (" + event.ticker() + ") is now available for IPO at $"
                + event.ipoPrice() + " — " + event.totalShares() + " shares."
        ));
    }

    public void handleSharesIssued(SharesIssuedEvent event) {
        // Company: personal confirmation
        repository.save(new Notification(
            event.companyUserId(),
            "SHARES_ISSUED",
            "Shares Issued Successfully",
            event.additionalShares() + " new shares of " + event.ticker()
                + " issued at $" + event.price() + "."
        ));

        // Broadcast: all users see new supply available
        repository.save(Notification.broadcast(
            "SHARES_ISSUED",
            "New Shares: " + event.ticker(),
            event.companyName() + " (" + event.ticker() + ") added "
                + event.additionalShares() + " shares at $" + event.price() + "."
        ));
    }

    // ── Trader events ─────────────────────────────────────────────────────────

    public void handleIpoPurchased(IpoPurchasedEvent event) {
        // Buyer notification
        repository.save(new Notification(
            event.userId(),
            "IPO_PURCHASED",
            "IPO Purchase Successful",
            "You bought " + event.quantity() + " " + event.ticker()
                + " shares at $" + event.pricePerShare()
                + " (total $" + event.totalCost() + ")."
        ));

        // Company notification: someone bought their IPO shares
        registryRepo.findByTicker(event.ticker()).ifPresent(reg ->
            repository.save(new Notification(
                reg.getCompanyUserId(),
                "COMPANY_IPO_SALE",
                "IPO Shares Purchased",
                event.quantity() + " shares of " + event.ticker()
                    + " were purchased at $" + event.pricePerShare()
                    + " (revenue $" + event.totalCost() + ")."
            ))
        );
    }

    public void handleOrderPlaced(OrderPlacedEvent event) {
        String action    = "BUY".equalsIgnoreCase(event.side()) ? "Buy" : "Sell";
        String priceDesc = event.limitPrice() != null ? " at $" + event.limitPrice() : " (market)";
        repository.save(new Notification(
            event.userId(),
            "ORDER_PLACED",
            "Order Placed",
            action + " order for " + event.quantity() + " " + event.ticker() + priceDesc + " is pending."
        ));
    }

    public void handleTradeExecuted(TradeExecutedEvent event) {
        String tradeDetail = event.quantity() + " " + event.ticker()
            + " at $" + event.price() + " (total $" + event.value() + ")";

        repository.save(new Notification(event.buyerId(),  "TRADE_EXECUTED", "Trade Executed — Bought", "Bought " + tradeDetail));
        repository.save(new Notification(event.sellerId(), "TRADE_EXECUTED", "Trade Executed — Sold",   "Sold "   + tradeDetail));

        // Company notification: secondary market activity on their ticker
        registryRepo.findByTicker(event.ticker()).ifPresent(reg ->
            repository.save(new Notification(
                reg.getCompanyUserId(),
                "COMPANY_TRADE",
                "Secondary Trade on " + event.ticker(),
                event.quantity() + " shares traded at $" + event.price()
                    + " (value $" + event.value() + ") on the secondary market."
            ))
        );
    }

    public void handleOrderCancelled(OrderCancelledEvent event) {
        if (event.userId() == null) return;
        String reason = "MARKET_NO_LIQUIDITY".equals(event.reason())
            ? "no matching orders available"
            : "cancelled by you";
        repository.save(new Notification(
            event.userId(),
            "ORDER_CANCELLED",
            "Order Cancelled",
            "Your order for " + event.remainingQty() + " " + event.ticker()
                + " was cancelled (" + reason + ")."
        ));
    }

    // ── Read / query ──────────────────────────────────────────────────────────

    public List<Notification> getForUser(Long userId) {
        List<Notification> all = new ArrayList<>();
        all.addAll(repository.findByUserIdOrderByCreatedAtDesc(userId));
        // Only show broadcasts that user hasn't dismissed
        all.addAll(repository.findByBroadcastTrueAndDismissedByUserIdNotContaining(userId));
        all.sort(Comparator.comparing(Notification::getCreatedAt).reversed());
        return all;
    }

    // Unread count excludes broadcasts (they are announcements, not personal alerts)
    public long countUnread(Long userId) {
        return repository.countByUserIdAndReadFalse(userId);
    }

    public void markRead(String id, Long userId) {
        repository.findById(id).ifPresent(n -> {
            if (n.isBroadcast()) {
                n.getDismissedByUserIds().add(userId); // track per-user dismissal
            } else if (n.getUserId().equals(userId)) {
                n.setRead(true);
            }
            repository.save(n);
        });
    }

    public void markAllRead(Long userId) {
        // Personal notifications
        List<Notification> unread = repository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        repository.saveAll(unread);

        // Broadcast notifications — add userId to dismissed list
        List<Notification> broadcasts = repository.findByBroadcastTrueAndDismissedByUserIdNotContaining(userId);
        broadcasts.forEach(n -> n.getDismissedByUserIds().add(userId));
        repository.saveAll(broadcasts);
    }

    public void delete(String id, Long userId) {
        repository.findById(id).ifPresent(n -> {
            if (n.isBroadcast()) {
                n.getDismissedByUserIds().add(userId); // soft delete for broadcasts
                repository.save(n);
            } else if (n.getUserId().equals(userId)) {
                repository.deleteById(id);
            }
        });
    }
}
