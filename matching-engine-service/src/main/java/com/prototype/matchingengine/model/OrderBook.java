package com.prototype.matchingengine.model;

import java.util.Comparator;
import java.util.PriorityQueue;

public class OrderBook {

    // Bids: highest price wins; equal price → earliest timestamp wins
    public final PriorityQueue<OrderEntry> bids = new PriorityQueue<>(
        Comparator.comparing((OrderEntry e) -> e.limitPrice).reversed()
                  .thenComparingLong(e -> e.timestamp)
    );

    // Asks: lowest price wins; equal price → earliest timestamp wins
    public final PriorityQueue<OrderEntry> asks = new PriorityQueue<>(
        Comparator.comparing((OrderEntry e) -> e.limitPrice)
                  .thenComparingLong(e -> e.timestamp)
    );
}
