package com.prototype.gateway.security;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Gateway-level authentication and authorization filter.
 *
 * Access matrix:
 *   PUBLIC        — no token needed
 *   ROLE_USER     — any authenticated user (trader)
 *   ROLE_COMPANY  — company users + admins
 *   ROLE_ADMIN    — admins only
 *
 * Paths are matched in order: public check → token validation → role check.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    // ── Public paths — no JWT required ─────────────────────────────────
    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/api/users/login",    // POST  — login
            "/api/users/register", // POST  — self-registration
            "/api/prices/",        // GET   — market prices (price-service has no auth)
            "/ws/",                // WebSocket live feed
            "/actuator/"           // health / info
    );

    // ── Role-restricted prefixes ────────────────────────────────────────
    // Requires ROLE_COMPANY or ROLE_ADMIN
    private static final String COMPANY_PREFIX = "/api/companies/";
    // Requires ROLE_ADMIN only
    private static final String ADMIN_PREFIX   = "/api/users/admin/";

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {

        // Always pass CORS pre-flight — browser sends this before every request
        if (exchange.getRequest().getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        String path = exchange.getRequest().getURI().getPath();

        // ── 1. Public paths bypass JWT check entirely ───────────────────
        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        // ── 2. All other paths need a valid Bearer token ────────────────
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("No token for path={}", path);
            return respond(exchange, HttpStatus.UNAUTHORIZED);
        }

        Claims claims;
        try {
            claims = jwtService.parse(authHeader.substring(7));
        } catch (Exception e) {
            log.warn("Invalid token for path={}: {}", path, e.getMessage());
            return respond(exchange, HttpStatus.UNAUTHORIZED);
        }

        String userId = String.valueOf(claims.get("userId"));
        String role   = claims.get("role", String.class);
        if (role == null) role = "ROLE_USER";

        // ── 3. Role-based access control ───────────────────────────────
        if (path.startsWith(ADMIN_PREFIX)) {
            if (!"ROLE_ADMIN".equals(role)) {
                log.warn("Forbidden admin path={} role={}", path, role);
                return respond(exchange, HttpStatus.FORBIDDEN);
            }
        } else if (path.startsWith(COMPANY_PREFIX)) {
            if (!"ROLE_COMPANY".equals(role) && !"ROLE_ADMIN".equals(role)) {
                log.warn("Forbidden company path={} role={}", path, role);
                return respond(exchange, HttpStatus.FORBIDDEN);
            }
        }

        // ── 4. Forward with enriched identity headers ───────────────────
        final String resolvedRole = role;
        ServerWebExchange enriched = exchange.mutate()
                .request(r -> r
                        .header("X-User-Id",   userId)
                        .header("X-User-Role", resolvedRole))
                .build();

        return chain.filter(enriched);
    }

    @Override
    public int getOrder() { return -100; } // Before routing filters, after CORS

    private boolean isPublic(String path) {
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private Mono<Void> respond(ServerWebExchange exchange, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        return exchange.getResponse().setComplete();
    }
}