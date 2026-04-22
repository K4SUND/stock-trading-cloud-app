package com.prototype.priceservice.controller;

import com.prototype.priceservice.dto.StockAdminRequest;
import com.prototype.priceservice.dto.StockPriceResponse;
import com.prototype.priceservice.service.PriceBroadcastService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/prices")
public class PriceController {
    private final PriceBroadcastService priceBroadcastService;

    public PriceController(PriceBroadcastService priceBroadcastService) {
        this.priceBroadcastService = priceBroadcastService;
    }

    @GetMapping("/stocks")
    public ResponseEntity<List<StockPriceResponse>> allPrices() {
        return ResponseEntity.ok(priceBroadcastService.allPrices());
    }

    @GetMapping("/stocks/{ticker}")
    public ResponseEntity<StockPriceResponse> onePrice(@PathVariable String ticker) {
        return ResponseEntity.ok(priceBroadcastService.onePrice(ticker));
    }

    // Internal endpoint — called by company-service over the Docker network
    @PostMapping("/stocks/internal")
    public ResponseEntity<StockPriceResponse> createOrUpdateStock(@RequestBody StockAdminRequest request) {
        return ResponseEntity.ok(priceBroadcastService.createOrUpdateStock(request.ticker(), request.price()));
    }
}
