package com.prototype.matchingengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prototype.matchingengine.dto.OpenOrderDto;
import com.prototype.matchingengine.dto.OrderBookSnapshot;
import com.prototype.matchingengine.dto.PriceLevel;
import com.prototype.matchingengine.events.OrderCancelledEvent;
import com.prototype.matchingengine.events.OrderPlacedEvent;
import com.prototype.matchingengine.events.TradeExecutedEvent;
import com.prototype.matchingengine.model.OrderBook;
import com.prototype.matchingengine.model.OrderEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MatchingEngineService {
    private static final Logger log = LoggerFactory.getLogger(MatchingEngineService.class);

    private final ConcurrentHashMap<String, OrderBook> books = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object>    locks = new ConcurrentHashMap<>();

    private final RabbitPublisher rabbitPublisher;
    private final ObjectMapper   objectMapper = new ObjectMapper();

    public MatchingEngineService(RabbitPublisher rabbitPublisher) {
        this.rabbitPublisher = rabbitPublisher;
    }

    // ── Startup: rebuild books from order-service DB ────────────────────────
    public void seed(List<OpenOrderDto> openOrders) {
        for (OpenOrderDto dto : openOrders) {
            if ("MARKET".equals(dto.mode())) continue;
            OrderBook book = bookFor(dto.ticker());
            OrderEntry entry = new OrderEntry(
                dto.orderId(), dto.userId(), dto.ticker(),
                dto.side(), dto.limitPrice(), dto.remainingQty(), dto.placedAt());
            synchronized (lockFor(dto.ticker())) {
                if ("BUY".equals(dto.side())) book.bids.add(entry);
                else                           book.asks.add(entry);
            }
        }
        log.info("Order book seeded with {} open orders across {} tickers",
            openOrders.size(), books.size());
    }

    // ── Message bus: new order placed ───────────────────────────────────────
    @RabbitListener(queues = "matching-engine.order-placed")
    public void onOrderPlaced(String payload) throws Exception {
        OrderPlacedEvent event = objectMapper.readValue(payload, OrderPlacedEvent.class);
        log.debug("Order placed orderId={} side={} mode={} ticker={} qty={} limitPrice={}",
            event.orderId(), event.side(), event.mode(), event.ticker(),
            event.quantity(), event.limitPrice());

        OrderBook book = bookFor(event.ticker());
        synchronized (lockFor(event.ticker())) {
            if ("BUY".equals(event.side())) matchBuy(event, book);
            else                             matchSell(event, book);
        }
    }

    // ── Message bus: order cancelled ────────────────────────────────────────
    @RabbitListener(queues = "matching-engine.order-cancelled")
    public void onOrderCancelled(String payload) throws Exception {
        OrderCancelledEvent event = objectMapper.readValue(payload, OrderCancelledEvent.class);
        OrderBook book = bookFor(event.ticker());
        synchronized (lockFor(event.ticker())) {
            evict(book.bids, event.orderId());
            evict(book.asks, event.orderId());
        }
        log.info("Evicted orderId={} from book ticker={}", event.orderId(), event.ticker());
    }

    // ── BUY matching: walk asks from lowest price up ────────────────────────
    private void matchBuy(OrderPlacedEvent event, OrderBook book) {
        boolean isMarket = "MARKET".equals(event.mode());
        int remaining = event.quantity();

        while (remaining > 0 && !book.asks.isEmpty()) {
            OrderEntry bestAsk = book.asks.peek();

            if (!isMarket && event.limitPrice().compareTo(bestAsk.limitPrice) < 0) break;

            book.asks.poll();
            int tradeQty   = Math.min(remaining, bestAsk.remainingQty);
            BigDecimal tradePrice = bestAsk.limitPrice; // passive order sets price
            BigDecimal tradeValue = tradePrice.multiply(BigDecimal.valueOf(tradeQty));

            rabbitPublisher.publishTrade(new TradeExecutedEvent(
                UUID.randomUUID().toString(),
                event.ticker(),
                event.orderId(), bestAsk.orderId,
                event.userId(), bestAsk.userId,
                tradeQty, tradePrice, tradeValue,
                System.currentTimeMillis()
            ));

            log.info("TRADE ticker={} qty={} price={} buyOrderId={} sellOrderId={}",
                event.ticker(), tradeQty, tradePrice, event.orderId(), bestAsk.orderId);

            remaining -= tradeQty;
            bestAsk.remainingQty -= tradeQty;
            if (bestAsk.remainingQty > 0) book.asks.add(bestAsk);
        }

        if (remaining > 0 && !isMarket) {
            book.bids.add(new OrderEntry(
                event.orderId(), event.userId(), event.ticker(),
                "BUY", event.limitPrice(), remaining, event.timestamp()));
        }
        if (remaining > 0 && isMarket) {
            rabbitPublisher.publishCancelled(new OrderCancelledEvent(
                event.orderId(), event.userId(), event.ticker(), remaining, "MARKET_NO_LIQUIDITY"));
        }
    }

    // ── SELL matching: walk bids from highest price down ────────────────────
    private void matchSell(OrderPlacedEvent event, OrderBook book) {
        boolean isMarket = "MARKET".equals(event.mode());
        int remaining = event.quantity();

        while (remaining > 0 && !book.bids.isEmpty()) {
            OrderEntry bestBid = book.bids.peek();

            if (!isMarket && event.limitPrice().compareTo(bestBid.limitPrice) > 0) break;

            book.bids.poll();
            int tradeQty   = Math.min(remaining, bestBid.remainingQty);
            BigDecimal tradePrice = bestBid.limitPrice;
            BigDecimal tradeValue = tradePrice.multiply(BigDecimal.valueOf(tradeQty));

            rabbitPublisher.publishTrade(new TradeExecutedEvent(
                UUID.randomUUID().toString(),
                event.ticker(),
                bestBid.orderId, event.orderId(),
                bestBid.userId, event.userId(),
                tradeQty, tradePrice, tradeValue,
                System.currentTimeMillis()
            ));

            log.info("TRADE ticker={} qty={} price={} buyOrderId={} sellOrderId={}",
                event.ticker(), tradeQty, tradePrice, bestBid.orderId, event.orderId());

            remaining -= tradeQty;
            bestBid.remainingQty -= tradeQty;
            if (bestBid.remainingQty > 0) book.bids.add(bestBid);
        }

        if (remaining > 0 && !isMarket) {
            book.asks.add(new OrderEntry(
                event.orderId(), event.userId(), event.ticker(),
                "SELL", event.limitPrice(), remaining, event.timestamp()));
        }
        if (remaining > 0 && isMarket) {
            rabbitPublisher.publishCancelled(new OrderCancelledEvent(
                event.orderId(), event.userId(), event.ticker(), remaining, "MARKET_NO_LIQUIDITY"));
        }
    }

    // ── REST: order book snapshot ───────────────────────────────────────────
    public OrderBookSnapshot snapshot(String ticker) {
        OrderBook book = books.get(ticker.toUpperCase());
        if (book == null) return new OrderBookSnapshot(ticker.toUpperCase(), List.of(), List.of());

        synchronized (lockFor(ticker.toUpperCase())) {
            return new OrderBookSnapshot(
                ticker.toUpperCase(),
                aggregateLevels(new PriorityQueue<>(book.bids), 10),
                aggregateLevels(new PriorityQueue<>(book.asks), 10));
        }
    }

    private List<PriceLevel> aggregateLevels(PriorityQueue<OrderEntry> queue, int maxLevels) {
        Map<BigDecimal, int[]> agg = new LinkedHashMap<>();
        while (!queue.isEmpty() && agg.size() < maxLevels) {
            OrderEntry e = queue.poll();
            agg.computeIfAbsent(e.limitPrice, p -> new int[]{0, 0});
            agg.get(e.limitPrice)[0] += e.remainingQty;
            agg.get(e.limitPrice)[1]++;
        }
        return agg.entrySet().stream()
            .map(en -> new PriceLevel(en.getKey(), en.getValue()[0], en.getValue()[1]))
            .toList();
    }

    private void evict(PriorityQueue<OrderEntry> queue, long orderId) {
        queue.removeIf(e -> e.orderId == orderId);
    }

    private OrderBook bookFor(String ticker) {
        return books.computeIfAbsent(ticker.toUpperCase(), t -> new OrderBook());
    }

    private Object lockFor(String ticker) {
        return locks.computeIfAbsent(ticker.toUpperCase(), t -> new Object());
    }
}
