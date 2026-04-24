package com.prototype.matchingengine.recovery;

import com.prototype.matchingengine.dto.OpenOrderDto;
import com.prototype.matchingengine.service.MatchingEngineService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * On startup, fetches all OPEN/PARTIALLY_FILLED orders from order-service and
 * rebuilds the in-memory order books. This makes the matching engine resilient
 * to restarts — state is derived from the order-service DB, not stored locally.
 */
@Component
public class OrderBookRecovery implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(OrderBookRecovery.class);

    private final MatchingEngineService matchingEngineService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final String orderServiceUrl;

    public OrderBookRecovery(MatchingEngineService matchingEngineService,
                             @Value("${order-service.url}") String orderServiceUrl) {
        this.matchingEngineService = matchingEngineService;
        this.orderServiceUrl       = orderServiceUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        String url = orderServiceUrl + "/api/orders/internal/open";
        try {
            List<OpenOrderDto> openOrders = restTemplate.exchange(
                url, HttpMethod.GET, null,
                new ParameterizedTypeReference<List<OpenOrderDto>>() {}
            ).getBody();

            if (openOrders != null && !openOrders.isEmpty()) {
                matchingEngineService.seed(openOrders);
                log.info("Recovery complete: loaded {} open orders", openOrders.size());
            } else {
                log.info("Recovery: no open orders found, starting with empty books");
            }
        } catch (Exception e) {
            log.warn("Recovery failed (order-service may not be ready yet): {}. Starting with empty books.", e.getMessage());
        }
    }
}
