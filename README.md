# 🎟️ SmartQueue — Distributed Ticket Booking System

> A production-grade, high-concurrency seat booking engine with real-time surge pricing, distributed locking, and event-driven architecture.

![Tech Stack](https://img.shields.io/badge/Node.js-TypeScript-blue) ![Redis](https://img.shields.io/badge/Redis-Distributed%20Lock-red) ![Kafka](https://img.shields.io/badge/Kafka-Event%20Streaming-black) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue) ![React](https://img.shields.io/badge/React-Frontend-cyan)

---

## 📸 Screenshots

### Events Page
> Browse upcoming events with live demand indicators and surge pricing badges.

![Events Page](./client/public/images/Screenshot%202026-05-13%20144742.png)

### Live Seat Map
> Real-time seat selection with live price updates, demand bar, and availability counter.

![Seat Map](./client/public/images/Screenshot%202026-05-13%20145550.png)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│              React + TypeScript (Vite) — Port 5173              │
│         Socket.io Client ←→ REST API (axios)                    │
└───────────────────┬─────────────────────┬───────────────────────┘
                    │ HTTP                 │ WebSocket
                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                          │
│           Express.js Server — Port 5000                         │
│     JWT Auth Middleware | Rate Limiting | CORS                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ /api/auth    │  │ /api/events  │  │ /api/bookings        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                     Socket.io Server                            │
└───────────────────┬─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CORE SERVICES LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth Service │  │Booking Svc   │  │  Pricing Engine      │  │
│  │ bcrypt + JWT │  │+ Lock Svc    │  │  Kafka Consumer      │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────┘  │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │BullMQ Worker│                              │
│                    │(Queue Proc.)│                              │
│                    └─────────────┘                              │
└──────────┬──────────────┬─────────────────┬─────────────────────┘
           ▼              ▼                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    DATA & INFRA LAYER                          │
│  ┌────────────┐  ┌────────────────────────┐  ┌─────────────┐  │
│  │ PostgreSQL │  │         Redis          │  │    Kafka    │  │
│  │            │  │  • Distributed Lock    │  │             │  │
│  │ • users    │  │  • Seat Cache          │  │ • booking-  │  │
│  │ • events   │  │  • Surge Price Cache   │  │   confirmed │  │
│  │ • seats    │  │  • Pub/Sub Channel     │  │   topic     │  │
│  │ • bookings │  │  • BullMQ Jobs         │  │             │  │
│  │ • price_   │  └────────────────────────┘  └─────────────┘  │
│  │   snapshots│                                                │
│  └────────────┘                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Critical Flow: How Booking Works

```
User clicks "Book Seat"
        │
        ▼
POST /api/bookings (JWT auth verified)
        │
        ▼
BullMQ Queue  ←── Job enqueued, jobId returned (202 Accepted)
        │
        ▼
Queue Worker picks job
        │
        ▼
Redis SET lock:seat:{id} NX PX 10000
  ├─ Lock acquired? ──YES──► Check seat status in PostgreSQL
  │                                  │
  └─ Lock exists? ───NO───► 409 Conflict (seat locked)
                                     │
                              Seat available?
                                  │
                         ┌────────▼────────┐
                         │  BEGIN TX       │
                         │  UPDATE seats   │
                         │  INSERT booking │
                         │  COMMIT         │
                         └────────┬────────┘
                                  │
                         Publish to Kafka
                         "booking-confirmed"
                                  │
                         ┌────────▼────────┐
                         │ Pricing Engine  │
                         │ Consumer reads  │
                         │ Calculates surge│
                         │ Updates Redis   │
                         └────────┬────────┘
                                  │
                         Redis PUBLISH
                         "price_updates"
                                  │
                         WebSocket Server
                         broadcasts to all
                         clients in room
                                  │
                         React UI updates
                         price + seat live
```

---

## 💡 Key Design Decisions

### 1. Why Redis Distributed Lock? (Not DB-level locks)

**The Problem:** When 1000 users try to book the same seat simultaneously, a naive implementation would run 1000 concurrent DB queries — all reading "available", all trying to write "booked". This causes a race condition where multiple users get confirmed for the same seat.

**The Solution:** Redis `SET key value NX PX 10000`

```
SET lock:seat:{seatId} "locked" NX PX 10000
```

- `NX` = Only set if **N**ot e**X**ists — atomic operation, only ONE worker wins
- `PX 10000` = Auto-expire in 10 seconds if server crashes (prevents deadlock)
- Returns `"OK"` on success, `null` if already locked

**Why Redis over PostgreSQL advisory locks?**
- Redis lock check is O(1) and takes ~0.1ms vs DB round-trip of 2-5ms
- Redis handles the lock externally — the DB connection is only opened after the lock is confirmed
- Scales horizontally — multiple server instances share the same Redis lock store

---

### 2. Why BullMQ Queue? (Not direct DB writes)

**The Problem:** A flash sale hits and 50,000 booking requests arrive in 10 seconds. Sending all of them directly to the booking service would:
- Exhaust the PostgreSQL connection pool (default: 10 connections)
- Cause cascading timeouts and failures
- Result in a terrible user experience

**The Solution:** BullMQ job queue backed by Redis

```
User Request → BullMQ Queue → Worker (controlled concurrency)
   202ms ←── jobId returned    └── 5 jobs processed at a time
```

**Benefits:**
- **Instant API response** — user gets `jobId` in milliseconds, not seconds
- **Backpressure** — queue absorbs the spike, workers process at safe rate
- **Retries** — failed jobs automatically retry with exponential backoff (1s → 2s → 4s)
- **Visibility** — poll `GET /bookings/job/:jobId` to check real-time status
- **Durability** — jobs survive server restarts (stored in Redis)

---

### 3. Why Kafka? (Not direct service calls)

**The Problem:** After a booking, the pricing engine needs to recalculate surge prices. A direct call from the booking service to the pricing service creates **tight coupling**:
- If the pricing service is down → booking fails too
- Adding a notification service later → must modify booking service
- High load on pricing service blocks booking service

**The Solution:** Kafka event streaming

```
Booking Service ──PUBLISH──► Kafka Topic: "booking-confirmed"
                                      │
                          ┌───────────┴────────────┐
                          ▼                         ▼
                   Pricing Engine           (Future: Notification
                   Consumer                  Service, Analytics...)
```

**Benefits:**
- **Decoupling** — booking service doesn't know or care what happens next
- **Extensibility** — add new consumers (email notifications, analytics, fraud detection) without touching booking service
- **Replay** — Kafka retains messages, consumers can replay from any offset
- **Fan-out** — one booking event can trigger multiple downstream services simultaneously

---

### 4. Surge Pricing Formula

```
demand_score = bookings_in_last_5_min / total_seats    (range: 0 to 1)
surge_price  = base_price × (1 + demand_score × 0.5)  (max: 2× base)

Examples:
  0% demand  → ₹2500 × (1 + 0 × 0.5)    = ₹2500  (base price)
 10% demand  → ₹2500 × (1 + 0.1 × 0.5)  = ₹2625
 50% demand  → ₹2500 × (1 + 0.5 × 0.5)  = ₹3125
100% demand  → ₹2500 × (1 + 1.0 × 0.5)  = ₹3750  (capped at 2× = ₹5000)
```

Price updates flow: `Kafka Consumer → Redis → WebSocket → React UI` in under 100ms.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + TypeScript | Component-based UI |
| Styling | TailwindCSS | Utility-first styling |
| Real-time | Socket.io | Live seat + price updates |
| Backend | Node.js + Express | REST API server |
| Queue | BullMQ | Job queue for booking requests |
| Cache + Lock | Redis (ioredis) | Distributed lock, seat cache, pub/sub |
| Message Broker | Kafka (KafkaJS) | Event streaming |
| Database | PostgreSQL | ACID-compliant bookings storage |
| Auth | JWT + bcrypt | Stateless authentication |
| Containers | Docker + Compose | Local infra (Redis, Postgres, Kafka) |
| Language | TypeScript | End-to-end type safety |

---

## 📁 Project Structure

```
smartqueue/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── api/axios.ts             # Centralized API client
│       ├── context/AuthContext.tsx  # Global auth state
│       ├── hooks/useSocket.ts       # WebSocket hook
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── EventsPage.tsx       # Events listing with surge badges
│       │   ├── EventDetailPage.tsx  # Live seat map + booking
│       │   └── MyBookingsPage.tsx   # User booking history
│       ├── components/Navbar.tsx
│       └── types/index.ts           # Shared TypeScript types
│
├── server/                          # Node.js backend (Express)
│   └── src/
│       ├── config/
│       │   ├── env.ts               # Centralized env config
│       │   └── redis.ts             # Redis connection
│       ├── db/
│       │   ├── index.ts             # PostgreSQL pool
│       │   ├── migrate.ts           # Migration runner
│       │   └── migrations/          # SQL migration files
│       │       ├── 001_users.sql
│       │       ├── 002_events.sql
│       │       ├── 003_seats.sql
│       │       ├── 004_bookings.sql
│       │       └── 005_price_snapshots.sql
│       ├── kafka/
│       │   ├── producer.ts          # Kafka producer
│       │   └── consumer.ts          # Pricing engine consumer
│       ├── middleware/
│       │   └── auth.middleware.ts   # JWT verification
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── event.routes.ts
│       │   └── booking.routes.ts
│       ├── services/
│       │   ├── auth.service.ts      # Register + login logic
│       │   ├── event.service.ts     # Event + seat CRUD
│       │   ├── booking.service.ts   # Core booking + DB transaction
│       │   └── lock.service.ts      # Redis distributed lock
│       ├── socket/
│       │   └── socket.server.ts     # WebSocket + Redis pub/sub
│       ├── workers/
│       │   └── booking.worker.ts    # BullMQ job processor
│       └── index.ts                 # App entry point
│
├── docker-compose.yml               # PostgreSQL + Redis + Kafka
├── .env.example                     # Environment variable template
└── README.md
```

---

## 🚀 How to Run Locally

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | v22.x (LTS) | https://nodejs.org |
| Docker Desktop | Latest | https://docker.com/products/docker-desktop |
| Git | Latest | https://git-scm.com |

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/smartqueue.git
cd smartqueue
```

---

### Step 2 — Start Docker infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`
- **Kafka + Zookeeper** on port `9092`

Verify all containers are running:
```bash
docker compose ps
```

---

### Step 3 — Configure environment variables

```bash
cd server
cp ../.env.example .env
```

Your `.env` should contain:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=smartqueue
DB_PASSWORD=smartqueue123
DB_NAME=smartqueue_db

REDIS_HOST=localhost
REDIS_PORT=6379

KAFKA_BROKER=localhost:9092

JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
```

---

### Step 4 — Run database migrations

```bash
cd server
npm install
npm run migrate
```

Expected output:
```
📦 Running 5 migration(s)...
✅ Migrated: 001_users.sql
✅ Migrated: 002_events.sql
✅ Migrated: 003_seats.sql
✅ Migrated: 004_bookings.sql
✅ Migrated: 005_price_snapshots.sql
🎉 All migrations complete!
```

---

### Step 5 — Start the backend server

```bash
# Inside server/ folder
npm run dev
```

Expected output:
```
⚙️  Booking worker started
✅ Kafka producer connected
✅ Kafka consumer connected
✅ WebSocket subscribed to Redis price_updates channel
🚀 Server running on http://localhost:5000
✅ PostgreSQL connected
✅ Redis connected
```

---

### Step 6 — Start the frontend

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

Expected output:
```
VITE v6.x  ready in 268ms
➜  Local: http://localhost:5173/
```

---

### Step 7 — Seed a test event

Use Postman or curl to create an event:

```bash
# 1. Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"123456"}'

# 2. Copy the token from response, then create an event
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Coldplay Live in Mumbai",
    "venue": "DY Patil Stadium",
    "description": "Music of the Spheres World Tour",
    "event_date": "2026-12-15T18:00:00Z",
    "total_seats": 20,
    "base_price": 2500,
    "rows": 4,
    "seats_per_row": 5
  }'
```

---

### Step 8 — Open the app

Visit **http://localhost:5173** in your browser.

1. Register or login
2. Click on an event
3. Select a seat on the live seat map
4. Confirm booking — watch the price surge in real time!

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |

### Events
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Yes | List all events |
| GET | `/api/events/:id` | Yes | Get event with live price |
| POST | `/api/events` | Yes | Create event + auto-generate seats |
| GET | `/api/events/:id/seats` | Yes | Get seats (Redis cached) |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | Yes | Queue a booking, returns jobId |
| GET | `/api/bookings/job/:jobId` | Yes | Poll booking job status |
| GET | `/api/bookings/my` | Yes | Get user's bookings |

---

## 🗄️ Database Schema

```sql
users          id, name, email, password_hash, created_at
events         id, title, venue, description, event_date, total_seats, base_price, status
seats          id, event_id→events, seat_number, row_label, status, locked_until
bookings       id, user_id→users, seat_id→seats, event_id→events, price_paid, status
price_snapshots id, event_id→events, price, demand_score, recorded_at
```

---

## 🔑 Redis Key Design

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `lock:seat:{seatId}` | String | 10s | Distributed lock — prevents double booking |
| `seats:event:{eventId}` | String (JSON) | 60s | Seat list cache — reduces DB reads |
| `price:event:{eventId}` | String | No TTL | Current surge price |
| `demand:event:{eventId}` | String | 5min | Rolling demand score (0–1) |
| `price_updates` | Pub/Sub | — | Channel: pricing engine → WebSocket server |
| `seat_updates` | Pub/Sub | — | Channel: booking service → WebSocket server |

---

## ⚡ WebSocket Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join_event` | Client → Server | `eventId` | Join event room for live updates |
| `leave_event` | Client → Server | `eventId` | Leave event room |
| `price_updated` | Server → Client | `{eventId, newPrice, demandScore}` | Surge price changed |
| `seat_updated` | Server → Client | `{seatId, status}` | Seat status changed |

---


**Q: How do you prevent double booking?**
> Redis `SET NX` atomic operation — only one worker can acquire the lock. Second request gets `null` back instantly and returns 409.

**Q: Why queue the booking instead of processing directly?**
> Flash sales send thousands of requests per second. Queue absorbs the spike, workers process at controlled concurrency of 5. User gets instant `jobId` response instead of waiting.

**Q: Why Kafka over direct service calls?**
> Decoupling. Booking service publishes an event and moves on. Pricing engine, future notification service, analytics — all consume independently. If pricing engine is down, booking still works.

**Q: What if the Redis lock expires before the DB transaction finishes?**
> TTL is set conservatively at 10 seconds — a DB write takes under 100ms. Additionally, PostgreSQL `BEGIN/COMMIT` transaction provides a second safety layer inside the lock window.

**Q: How does the surge price reach the user's browser in real time?**
> Kafka consumer → Redis PUBLISH → WebSocket server subscribes via `redis.duplicate()` → Socket.io emits to event room → React state updates instantly.

---

## 👨‍💻 Author
- VARUN AGRAWAL
- COMPUTER SCIENCE AND ENGINEERING STUDENT AT NITRR BATCH 2027

Built as a system design portfolio project demonstrating distributed systems concepts: event-driven architecture, distributed locking, message queuing, real-time communication, and surge pricing algorithms.

This is AI generated Readme.md file, I have instructed AI to build this kind of file with above details.
