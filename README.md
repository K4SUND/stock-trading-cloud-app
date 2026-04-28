# Cloud-Native Stock Trading Platform

This project is a **cloud-native stock trading platform** built using a **microservices architecture** with event-driven communication.

It is designed as a **scalable, production-oriented system** and serves as the foundation for a **full-featured professional trading application**. The platform supports real-time trading workflows, asynchronous processing, and modular service evolution.

---

## Running the Project Locally

---

## Option 1: Run Everything with Docker Compose

### Prerequisites
- Docker Desktop
- Docker Compose plugin

### Steps

```bash
cd infra
docker compose up --build
````

### Access Services

| Service              | URL                                            |
| -------------------- | ---------------------------------------------- |
| Frontend             | [http://localhost:5173](http://localhost:5173) |
| API Gateway          | [http://localhost:8080](http://localhost:8080) |
| User Service         | [http://localhost:8081](http://localhost:8081) |
| Order Service        | [http://localhost:8082](http://localhost:8082) |
| Payment Service      | [http://localhost:8083](http://localhost:8083) |
| Price Service        | [http://localhost:8084](http://localhost:8084) |
| Company Service      | [http://localhost:8085](http://localhost:8085) |
| Matching Engine      | [http://localhost:8086](http://localhost:8086) |
| Notification Service | [http://localhost:8087](http://localhost:8087) |

---

## Option 2: Run Locally Without Docker (Development Mode)

### Step 1 — Start Infrastructure Only

```bash
cd infra
docker compose up postgres kafka zookeeper redis mongodb
```

---

### Step 2 — Run Backend Services

Open separate terminals for each service:

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

```bash
cd company-service
./mvnw spring-boot:run
```

```bash
cd matching-engine-service
./mvnw spring-boot:run
```

```bash
cd notification-service
./mvnw spring-boot:run
```

```bash
cd api-gateway
./mvnw spring-boot:run
```

---

### Step 3 — Run Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## System Overview

This platform follows a **microservices + event-driven architecture**:

* Services communicate via **REST (synchronous)** and **Kafka (asynchronous)**
* Each service owns its own data
* Real-time updates are delivered via **WebSockets**
* API Gateway acts as the **single entry point**

---

## Services and Responsibilities

| Service              | Port | Responsibility                                          |
| -------------------- | ---- | ------------------------------------------------------- |
| API Gateway          | 8080 | JWT validation, routing, CORS, user context propagation |
| User Service         | 8081 | Authentication, JWT issuance, role management           |
| Order Service        | 8082 | Order lifecycle, portfolio, trade history               |
| Payment Service      | 8083 | Wallet, balance validation, transactions                |
| Price Service        | 8084 | Stock prices, Redis caching, WebSocket updates          |
| Company Service      | 8085 | IPO management, company data                            |
| Matching Engine      | 8086 | Order matching, order book, partial fills               |
| Notification Service | 8087 | Real-time notifications (MongoDB)                       |

---

### Event-driven Processing

* **Payment Service**

  * Validates wallet balance
  * Publishes `payment-result`

* **Order Service**

  * Updates order status (SUCCESS / FAILED)
  * Publishes `order-completed`

* **Matching Engine**

  * Matches buy/sell orders
  * Handles partial fills

* **Price Service**

  * Updates stock price
  * Publishes real-time updates via WebSocket

* **Notification Service**

  * Sends trade alerts to users

---

## Kafka Topics

* `order-created`
* `payment-result`
* `order-completed`

---

## Data Layer

| Component  | Usage                                                     |
| ---------- | --------------------------------------------------------- |
| PostgreSQL | Core relational data (users, orders, payments, companies) |
| Redis      | Price caching and fast access                             |
| MongoDB    | Notifications storage                                     |
| Kafka      | Event streaming                                           |

---

## Key Features

* Microservices architecture
* Event-driven design using Kafka
* Real-time price updates (WebSocket)
* API Gateway with JWT security
* Order matching engine with partial fills
* IPO and company management
* Portfolio and wallet tracking
* Scalable and cloud-ready design

---

## Suggested Demo Flow

1. Register and login
2. Add funds to wallet
3. Place BUY order
4. Observe:

   * Order lifecycle updates
   * Kafka event logs
   * Matching engine execution
5. View portfolio changes
6. Watch live price updates
7. Receive notifications


```
```
