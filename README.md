# Simple Cloud-Native Stock Trading Prototype

This starter project implements a **simple stock buying/selling prototype** for your cloud computing assignment.
It includes:

- React frontend
- `user-service` for register/login with JWT
- `order-service` for buy/sell orders and portfolio
- `payment-service` for wallet balance and payment processing
- `price-service` for stock prices and WebSocket updates
- RabbitMQ for asynchronous events
- PostgreSQL for persistent data
- Docker Compose for local deployment
- Structured application logs

## Business flow

1. User registers and logs in.
2. Frontend loads stock prices from `price-service`.
3. Frontend subscribes to WebSocket price updates.
4. User places a BUY or SELL order using `order-service`.
5. `order-service` stores the order and publishes an `order-placed` message.
6. `matching-engine-service` consumes `order-placed`, executes matching, and publishes `trade-executed`.
7. `payment-service` consumes `trade-executed` and settles buyer/seller wallets.
8. `order-service` consumes `trade-executed` and updates order fills and portfolio positions.
9. `price-service` consumes `trade-executed` and updates stock price.
10. `price-service` broadcasts the new prices over WebSocket.

## Project structure

- `frontend/` - React + Vite app
- `user-service/` - Spring Boot auth service
- `order-service/` - Spring Boot orders and portfolio service
- `payment-service/` - Spring Boot wallet and payment service
- `price-service/` - Spring Boot pricing + WebSocket service
- `infra/` - Docker Compose and Postgres init scripts

## Prerequisites

### To run everything with Docker Compose
- Docker Desktop
- Docker Compose plugin

### To run backend/frontend without Docker
- Java 17
- Maven 3.9+
- Node.js 20+
- npm 10+
- PostgreSQL 15+
- RabbitMQ locally, or use Docker Compose only for infra

## Quick start with Docker Compose

From the project root:

```bash
cd infra
docker compose up --build
```

When everything is up, open:
- Frontend: `http://localhost:5173`
- User Service: `http://localhost:8081`
- Order Service: `http://localhost:8082`
- Payment Service: `http://localhost:8083`
- Price Service: `http://localhost:8084`

## Demo users / initial data

The app auto-creates sample stocks in `price-service` on first startup:
- ABC - 100.00
- XYZ - 250.00
- QRS - 75.00

You should:
1. Register a user in the UI.
2. Login.
3. Seed the user's wallet from the Payment page section.
4. Buy or sell stocks.

## Local run without Docker Compose (recommended for development)

### 1. Start infrastructure only

```bash
cd infra
docker compose up postgres rabbitmq redis mongodb
```

### 2. Run services in separate terminals

```bash
cd user-service
./mvnw spring-boot:run
```

```bash
cd order-service
./mvnw spring-boot:run
```

```bash
cd payment-service
./mvnw spring-boot:run
```

```bash
cd price-service
./mvnw spring-boot:run
```

### 3. Run frontend

```bash
cd frontend
npm install
npm run dev
```

## RabbitMQ routing keys used

- `order-placed`
- `order-cancelled`
- `trade-executed`
- `ipo-purchased`
- `stock-listed`
- `shares-issued`

## Logging

Each service logs:
- request handling
- order state changes
- payment decisions
- price updates
- RabbitMQ publish/consume actions

The logs are intentionally verbose so you can show them in your demo.

## Suggested demo flow

1. Register a user.
2. Login.
3. Add wallet balance.
4. Buy 3 shares of ABC.
5. Observe order as `PENDING`, then `COMPLETED`.
6. Observe price update in the stock list and WebSocket stream.
7. Sell some shares.
8. Show portfolio and wallet changes.
9. Show logs from services and RabbitMQ-driven flow.

## Notes

- This is a **prototype**, not a real trading engine.
- The price update algorithm is intentionally simple:
  - BUY increases price slightly
  - SELL decreases price slightly
- Services call each other with REST where immediate responses are needed, and use RabbitMQ for asynchronous internal workflows.
