# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

**Full stack via Docker Compose (recommended for demos):**
```bash
cd infra
docker compose up --build
```

**Infra only + services locally (recommended for development):**
```bash
# Terminal 1 – infrastructure
cd infra
docker compose up postgres rabbitmq redis mongodb

# Terminals 2–5 – one per service
cd user-service && ./mvnw spring-boot:run
cd order-service && ./mvnw spring-boot:run
cd payment-service && ./mvnw spring-boot:run
cd price-service && ./mvnw spring-boot:run

# Terminal 6 – frontend
cd frontend && npm install && npm run dev
```

**Build a single Spring Boot service (without running):**
```bash
cd <service-dir> && ./mvnw package -DskipTests
```

**Frontend dev server only:**
```bash
cd frontend && npm run dev
```

There are no automated tests in this project (test dependencies are present but no test classes exist).

## Service ports

| Service         | Port |
|-----------------|------|
| gateway-service | 8080 |
| user-service    | 8081 |
| order-service   | 8082 |
| payment-service | 8083 |
| price-service   | 8084 |
| company-service | 8085 |
| frontend        | 5173 |

The frontend and all external clients communicate exclusively through `gateway-service` (port 8080). Individual service ports are exposed only for direct debugging.

## Architecture

This is a microservices stock-trading prototype. Each Spring Boot service has its own PostgreSQL database (`usersdb`, `ordersdb`, `paymentsdb`, `pricesdb`) created by `infra/postgres-init/01-create-dbs.sql`. Schemas are auto-managed via `ddl-auto: update`.

**Async event flow (RabbitMQ):**
1. `order-service` receives a trade request, stores the order, and publishes `order-placed`
2. `matching-engine-service` consumes `order-placed`, matches orders, and publishes `trade-executed` (or `order-cancelled` when needed)
3. `order-service`, `payment-service`, `price-service`, and `notification-service` consume `trade-executed` for settlement, portfolio/order updates, and live price updates
4. `company-service` publishes `stock-listed` and `shares-issued`; `notification-service` consumes both

**Synchronous REST call:** When creating an order, `order-service` calls `price-service` via `RestTemplate` to fetch the current price before persisting the order. The URL is configured via `price-service.url` / `PRICE_SERVICE_URL`.

**RabbitMQ exchange/routing keys:** exchange `trading.events` with routing keys `order-placed`, `order-cancelled`, `trade-executed`, `ipo-purchased`, `stock-listed`, `shares-issued`

**API Gateway:** `gateway-service` (Spring Cloud Gateway, port 8080) is the single entry point for all frontend traffic. It validates JWT tokens centrally via a `GlobalFilter` before routing, adds `X-User-Id` and `X-User-Role` headers to downstream requests, and handles CORS. Public paths that bypass JWT: `/api/users/auth/**`, `/api/prices/**`, `/ws/**`. Downstream services retain their own JWT validation (defence in depth).

**Authentication:** `user-service` issues JWT tokens (24-hour expiry). The gateway validates tokens first; downstream services (`order-service`, `payment-service`, `company-service`) also validate independently using the same shared secret (`APP_JWT_SECRET`).

**Frontend:** Single-page React app (`frontend/src/App.jsx`) calls all backend services via the gateway at `http://localhost:8080` (defined in `frontend/src/api.js`). Live prices arrive via STOMP over SockJS connecting to `http://localhost:8080/ws` (proxied by gateway to price-service). The frontend stores the JWT and user object in `localStorage`.

**price-service** has no authentication on its endpoints — it is publicly readable. All other services require a `Bearer` token for protected endpoints.

## Key configuration

All Spring Boot services read configuration from environment variables with local defaults in `application.yml`:
- `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
- `SPRING_RABBITMQ_HOST` / `SPRING_RABBITMQ_PORT` / `SPRING_RABBITMQ_USERNAME` / `SPRING_RABBITMQ_PASSWORD`
- `APP_JWT_SECRET` — must be identical across all four services
- `PRICE_SERVICE_URL` — used only by `order-service` and `payment-service`