package com.prototype.matchingengine.controller;

import com.prototype.matchingengine.dto.OrderBookSnapshot;
import com.prototype.matchingengine.service.MatchingEngineService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/book")
public class OrderBookController {

    private final MatchingEngineService engine;

    public OrderBookController(MatchingEngineService engine) { this.engine = engine; }

    @GetMapping("/{ticker}")
    public ResponseEntity<OrderBookSnapshot> book(@PathVariable String ticker) {
        return ResponseEntity.ok(engine.snapshot(ticker));
    }
}
