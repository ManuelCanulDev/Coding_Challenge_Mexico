# Arbiter BTC

**Real-Time Bitcoin Arbitrage Intelligence Engine**

Arbiter BTC is a full-stack hackathon application that monitors public Bitcoin order books across major exchanges, detects cross-exchange arbitrage opportunities in real time, estimates net profitability after trading costs, and executes **fully simulated** trades against virtual wallets—all streamed to a professional live dashboard.

> **Simulation only.** No real orders. No private API keys. Built for technical evaluation, not live trading.

---

## What It Does

Bitcoin trades simultaneously on many venues. Bid/ask prices are not perfectly aligned: for brief windows, it can be cheaper to buy BTC on Exchange A and sell on Exchange B than to trade on a single venue. Capturing that edge in production requires fast market data, fee-aware math, liquidity checks, and strict risk controls.

**Arbiter BTC** solves the *analysis and decision* layer of that problem for a hackathon MVP:

1. Polls public BTC order books from **Binance, Kraken, Coinbase, and OKX** via [CCXT](https://github.com/ccxt/ccxt).
2. Compares every exchange pair and flags opportunities where **`buyExchange.ask < sellExchange.bid`**.
3. Computes **net profit** after exchange fees, slippage (top 10 book levels), and a latency penalty.
4. Simulates wallet balances, partial fills, and trade history.
5. Streams unified state to the frontend over **WebSocket** for a responsive operator dashboard.

The system demonstrates how a production arbitrage desk would *think*—without moving real capital.

---

## Challenge Objective

The Bitcoin Arbitrage Hackathon Challenge asks teams to build a system that:

- Monitors BTC prices across multiple exchanges.
- Detects price divergences that could theoretically be arbitraged.
- Models whether those divergences remain profitable after costs.
- Presents findings clearly for technical review.

Arbiter BTC addresses this end-to-end: from raw public market data to scored opportunities, simulated execution, P&L tracking, and risk safeguards—within a 24-hour MVP scope.

---

## Key Features

| Feature | Description |
|--------|-------------|
| **Real-time BTC market monitoring** | Polls public order books every **1.5s** with per-exchange latency measurement |
| **Multi-exchange order book comparison** | Normalized books from Binance, Kraken, Coinbase, OKX |
| **Arbitrage opportunity detection** | All pairwise combinations where ask < bid on another venue |
| **Net profitability calculation** | Gross spread minus fees, slippage, and latency penalty |
| **Fee-aware simulated execution** | Per-exchange fee model (Binance 0.10%, Kraken 0.26%, Coinbase 0.60%, OKX 0.10%) |
| **Slippage estimation** | Volume-weighted average price across top **10** order book levels |
| **Partial order execution** | Fills limited by book depth and simulated wallet balances |
| **Simulated wallets** | Independent fiat + BTC balances per exchange |
| **Risk engine** | Rejects opportunities that fail profit, volume, latency, or liquidity rules |
| **Circuit breaker** | Pauses auto-execution for **60s** after **3** consecutive negative simulated trades |
| **Opportunity Score (0–100)** | Weighted score with Excellent / Good / Moderate / Weak ratings |
| **Trade history** | Executed, partial, and rejected simulated trades with reasons |
| **Cumulative P&L chart** | Recharts area chart of simulated cumulative profit |
| **Responsive dashboard** | Dark, professional single-page UI (TailwindCSS) |

Additional resilience features:

- **Mock fallback** when a public CCXT feed fails (exchange marked `offline`, app keeps running).
- **`DEMO_MODE`** optional bps offsets for hackathon demos when real markets are too efficient to show executions.
- **`localStorage` persistence** on the frontend so trade history survives page reloads.

---

## Tech Stack

### Frontend

- **React 19** + **TypeScript**
- **Vite** (dev server & build)
- **TailwindCSS** (UI)
- **Recharts** (cumulative P&L visualization)
- WebSocket client with reconnect + `localStorage` history merge

### Backend

- **Node.js** + **TypeScript**
- **Express** (REST: `/health`, `/api/state`)
- **`ws`** (dedicated WebSocket broadcast server)
- **CCXT** (public order book fetching—no API keys)
- In-memory orchestration (`AppOrchestrator`)

### Deployment

- **Local:** npm workspaces + `concurrently`
- **Production target:** Docker, Docker Compose, and **Coolify**-compatible packaging *(planned—see [Docker](#docker-planned) below)*

---

## Project Architecture

```
arbiter-btc/
├── backend/
│   ├── src/
│   │   ├── config.ts              # Env, fees, wallets, demo mode
│   │   ├── index.ts               # Express HTTP server
│   │   ├── types/
│   │   ├── services/
│   │   │   ├── orderBookService.ts
│   │   │   ├── mockDataService.ts
│   │   │   ├── arbitrageEngine.ts
│   │   │   ├── slippageService.ts
│   │   │   ├── walletService.ts
│   │   │   ├── riskEngine.ts
│   │   │   └── orchestrator.ts
│   │   └── websocket/
│   │       └── wsServer.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/            # Dashboard sections
│   │   ├── hooks/useWebSocket.ts
│   │   ├── types/
│   │   ├── utils/format.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── screenshots/                   # Placeholder for demo captures
├── package.json                   # Root scripts (npm run dev)
├── .gitignore
└── README.md
```

**Planned deployment assets:** `Dockerfile`, `docker-compose.yml` (single-port production bundle for Coolify).

### Data flow

```
CCXT (public APIs)  →  OrderBookService  →  ArbitrageEngine
                              ↓                      ↓
                        Mock fallback          RiskEngine + WalletService
                              ↓                      ↓
                        AppOrchestrator  ←  Simulated trades
                              ↓
                   WebSocket broadcast  →  React dashboard
```

**Design choice:** HTTP (`PORT`) and WebSocket (`WS_PORT`) run on **separate ports** in development. This keeps the MVP simple to debug; production Docker packaging will reverse-proxy both behind one public port.

---

## How It Works

### Market Data Collection

- Every **1500 ms**, the backend fetches public order books for:
  - Binance & OKX → `BTC/USDT`
  - Kraken & Coinbase → `BTC/USD`
- Each book is normalized to a shared schema: best bid/ask, top 10 levels, timestamp, latency, online/offline status.
- If CCXT fails for an exchange, **realistic mock data** is used and the venue is marked `offline`.
- With `DEMO_MODE=true` (default), tiny per-exchange bps offsets can be applied so judges can observe simulated executions during efficient market conditions. Set `DEMO_MODE=false` for unmodified public prices.

### Arbitrage Detection

For every ordered pair `(buyExchange, sellExchange)` where `buyExchange ≠ sellExchange`:

```
IF buyExchange.ask < sellExchange.bid
   → opportunity detected
```

The engine ranks all opportunities by **Opportunity Score** (descending).

### Net Profit Calculation

Per opportunity/trade, the backend estimates:

```
notional = volumeBtc * buyPrice

buyFeeUsd = notional * buyFeeRate
sellFeeUsd = volumeBtc * sellPrice * sellFeeRate

grossProfitUsd = (sellPrice - buyPrice) * volumeBtc

netProfitUsd = grossProfitUsd
               - buyFeeUsd
               - sellFeeUsd
               - slippageUsd
               - latencyPenaltyUsd

netProfitPct = netProfitUsd / notional * 100
```

**Latency penalty:** `0.01%` of notional per **500 ms** of combined buy+sell fetch latency.

An opportunity is marked **executable** when `netProfitUsd > 0` and `netProfitPct > 0.02%`.

### Simulated Execution

When `AUTO_EXECUTE=true` and the risk engine approves the top opportunity:

1. Buy-side fiat is debited (including buy fee); BTC is credited on the buy exchange.
2. BTC is debited on the sell exchange; fiat is credited (minus sell fee).
3. Volume is capped by order book depth **and** simulated wallet balances.
4. Trades are recorded as `executed`, `partial`, or `rejected` with a human-readable `reason`.

Initial simulated balances per exchange: **100,000 USDT/USD** and **1 BTC**.

### Risk Engine

The system **rejects** simulated execution when:

| Rule | Default threshold |
|------|-------------------|
| Net profit too low | `netProfitPct ≤ 0.02%` |
| Insufficient liquidity | `maxExecutableBtc ≤ 0` |
| Wallet balance insufficient | Cannot fund buy or sell leg |
| Combined latency too high | `> 2000 ms` |
| Volume below minimum | `< 0.001 BTC` |
| Circuit breaker active | After 3 consecutive negative trades |

When rejected, the opportunity/trade includes an explicit **reason** string for the dashboard.

### Opportunity Score

Score is computed on a **0–100** scale:

```
score = netProfitPct * 10_000
        + liquidityScore
        - latencyPenaltyScore
        - riskPenalty

score = clamp(score, 0, 100)
```

| Score | Rating |
|-------|--------|
| 80–100 | Excellent |
| 60–79 | Good |
| 40–59 | Moderate |
| < 40 | Weak |

---

## Dashboard

Single-page dark dashboard with eight sections:

| Section | Content |
|---------|---------|
| **Header & bot status** | App title, bot Active/Paused, circuit breaker ON/OFF, WebSocket connection |
| **Market overview** | Per-exchange bid, ask, spread, latency, online/offline, last update |
| **Live opportunities** | Buy/sell venues, spreads, net profit, max BTC, score, rating, status, reason |
| **Simulated trades** | Timestamped execution log with volume, P&L, status |
| **Performance cards** | Total P&L, trades executed, opportunities detected/rejected, win rate, avg profit |
| **P&L chart** | Cumulative simulated profit over time (Recharts) |
| **Wallets** | Fiat + BTC balances and estimated total value per exchange |
| **Technical panel** | Data mode, execution mode, book depth, fee model, risk engine, strategy |

Color semantics: **green** = positive profit, **red** = rejected/negative, **amber** = warnings/partial states.

---

## Installation

### Prerequisites

- **Node.js 20+**
- **npm 10+**
- Internet access to public exchange APIs

### Quick start

```bash
git clone https://github.com/YOUR-USERNAME/arbiter-btc.git
cd arbiter-btc
npm install
npm run dev
```

This starts **both** backend and frontend via npm workspaces.

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend (HTTP)** | http://localhost:3001 |
| **WebSocket** | ws://localhost:3002 |

### Run services individually

From the **repository root**:

```bash
npm run dev:backend   # backend only
npm run dev:frontend  # frontend only
```

From **`backend/`**, use `npm run dev` (not `dev:backend`—that script lives in the root `package.json`).

### Optional environment setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Production build

```bash
npm run build
npm run build:backend   # backend only → backend/dist
npm run build:frontend  # frontend only → frontend/dist
```

Start compiled backend:

```bash
cd backend && npm start
```

---

## Docker (Planned)

Production deployment via **Docker Compose** and **Coolify** is the intended path: a single container (or compose stack) serving the built frontend statically and the API/WebSocket backend on one exposed port.

**Target command (planned):**

```bash
docker compose up --build
```

**Target production URL (planned):** http://localhost:4000

> Docker assets (`Dockerfile`, `docker-compose.yml`) are not yet committed. Local development uses the split-port setup above. See [Future Improvements](#future-improvements).

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `WS_PORT` | `3002` | WebSocket server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `POLL_INTERVAL_MS` | `1500` | Order book polling interval |
| `AUTO_EXECUTE` | `true` | Auto-run simulated trades |
| `MIN_NET_PROFIT_PCT` | `0.02` | Minimum net profit % |
| `MIN_VOLUME_BTC` | `0.001` | Minimum executable volume |
| `MAX_COMBINED_LATENCY_MS` | `2000` | Max combined fetch latency |
| `CIRCUIT_BREAKER_THRESHOLD` | `3` | Negative trades before pause |
| `CIRCUIT_BREAKER_COOLDOWN_MS` | `60000` | Circuit breaker cooldown |
| `DEMO_MODE` | `true` | Apply demo bps offsets (`false` = raw public prices) |

Example:

```env
PORT=3001
WS_PORT=3002
CORS_ORIGIN=http://localhost:5173
DEMO_MODE=false
```

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:3002` | WebSocket endpoint |
| `VITE_API_URL` | `http://localhost:3001` | REST API base (optional fallback) |

Example:

```env
VITE_WS_URL=ws://localhost:3002
VITE_API_URL=http://localhost:3001
```

**No API keys required.** CCXT uses public market data endpoints only.

---

## Screenshots

Add captures to `/screenshots` before submission. Expected filenames:

![Dashboard Overview](./screenshots/dashboard-overview.png)

![Live Opportunities](./screenshots/live-opportunities.png)

![Trade History and P&L](./screenshots/trade-history-pnl.png)

*(Placeholder directory included—replace with actual screenshots for the hackathon demo.)*

---

## Current Limitations

- **Simulation only** — no real order placement or settlement.
- **No private APIs** — public order books only; no authenticated account data.
- **In-memory backend state** — resets on server restart (frontend persists trade history in `localStorage`).
- **Public exchange API availability may vary** — rate limits, geo restrictions, or downtime affect feeds; mock fallback keeps the demo alive.
- **Simplified latency and withdrawal cost modeling** — no network transfer times, chain confirmations, or cross-exchange capital movement.
- **USDT/USD equivalence** — USDT and USD balances are treated as USD-equivalent for MVP math.
- **Polling, not native exchange WebSockets** — 1.5s REST polling is not HFT-grade.
- **Docker deployment not yet shipped** — local split-port dev is the current supported path.

---

## Future Improvements

- [ ] **Dockerfile + docker-compose.yml** for single-port Coolify deployment
- [ ] Native exchange **WebSocket** feeds instead of REST polling
- [ ] **Persistent database** (PostgreSQL) for trades and audit logs
- [ ] **Backtesting** mode with historical CCXT OHLCV / order book snapshots
- [ ] **Multi-asset** support (ETH, SOL, etc.)
- [ ] **Triangular arbitrage** (e.g. BTC → ETH → USDT → BTC)
- [ ] **Advanced latency modeling** (per-leg RTT, colocation assumptions)
- [ ] **Historical replay** for strategy validation
- [ ] **Authentication** and multi-user dashboards
- [ ] Exchange-specific **advanced fee profiles** (maker/taker tiers, VIP discounts)
- [ ] Dedicated **USDT/USD FX** normalization layer

---

## Technical Decisions (Hackathon MVP)

1. **npm workspaces monorepo** — one `npm run dev` for judges; minimal setup friction.
2. **Separate WebSocket port** — avoids Express upgrade complexity during rapid iteration.
3. **CCXT** — unified public API across four exchanges without custom integrations.
4. **Top-10 slippage model** — realistic enough for demo; avoids full book simulation cost.
5. **In-memory state + localStorage** — no database setup within 24 hours.
6. **Risk engine + circuit breaker** — shows production-minded guardrails even in simulation.
7. **Mock fallback + DEMO_MODE** — demo stability when APIs fail or markets are perfectly efficient.

---

## Disclaimer

Arbiter BTC is an **educational hackathon project** built to demonstrate real-time market analysis, arbitrage modeling, and risk-aware simulation. It is **not financial advice**, **not a trading product**, and **does not execute real transactions**. Never use this software to trade live assets without independent professional review and proper licensing/compliance.

---

## Author

Developed for the **Bitcoin Arbitrage Hackathon Challenge**.

---

## License

MIT — hackathon demonstration project.
