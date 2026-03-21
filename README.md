# Flow

**Quadratic Tipping Agent with Autonomous Matching Intelligence**

Flow is an autonomous agent that applies [quadratic funding](https://wtfisqf.com/) to Telegram-based cryptocurrency tipping. Every direct tip to a creator earns them a proportional share of a community matching pool, where the matching formula rewards breadth of support — many small tips outperform a single whale donation of equal total value.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Flow](#running-flow)
- [Telegram Bot Commands](#telegram-bot-commands)
- [Web Dashboard](#web-dashboard)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## How It Works

### Quadratic Funding Formula

Each creator's matching allocation is computed with integer-only arithmetic (BigInt, no floats):

```
quadratic_score(creator) = ( Σ √tip_amount_i )²
match_allocation(creator) = pool_balance × score(creator) / Σ all_scores
```

**Why this matters — equal totals, different breadth:**

| Creator | Tips received | Total direct | Quadratic score |
|---|---|---|---|
| Alice | 10 × 1 USDT | 10 USDT | `(10 × √1)² = 100` |
| Bob | 1 × 10 USDT | 10 USDT | `(1 × √10)² ≈ 10` |

Alice and Bob both received **10 USDT** in total, but Alice's score is 10× higher because her support came from ten independent contributors. Broad community support wins over concentrated whale donations.

### Round Lifecycle

```
Open → Locked → Analyzed → Executed → Archived → (new round opens)
```

1. **Open** — Tips accumulate throughout the round window (default: 24 hours).
2. **Locked** — New tips are paused; sybil analysis runs on the accumulated tip set.
3. **Analyzed** — Claude reviews the allocation plan for anomalies before execution.
4. **Executed** — USDT transfers are sent from the pool wallet to each creator.
5. **Archived** — Round report is published to IPFS with an agent signature for auditability.

### Sybil Protection

Flow uses a two-layer approach:
- **Rule-based checks** — multiple tips from the same wallet to the same creator, suspicious velocity (many tips in a short window), newly created wallets.
- **LLM analysis** — Claude receives aggregate behavior signals and returns a confidence score and weight multiplier (1.0 = clean, 0.5 = suspicious, 0.1 = likely sybil). Tip effective amounts are scaled by this weight before the quadratic formula is applied.

A 3× cap prevents any single creator from receiving more in matching than three times their direct tips, protecting against edge-case allocation outliers.

---

## Features

| Feature | Description |
|---|---|
| **Quadratic allocation** | BigInt-safe `isqrt` + `computeAllocations` engine |
| **Autonomous round management** | Cron-scheduled rounds with configurable duration |
| **LLM sybil detection** | Claude-powered tip analysis with per-tip weight multipliers |
| **Multi-chain wallets** | HD derivation for Polygon, Arbitrum, and Tron via ethers.js |
| **Telegram bot** | Full-featured bot: register, tip, withdraw, leaderboard, history |
| **Pool health monitor** | Every 30 minutes; dynamically adjusts matching multiplier (0.5×–2.0×) |
| **Web dashboard** | Real-time round metrics, leaderboard, and pool status |
| **IPFS publishing** | Immutable round reports with agent signature |
| **SQLite storage** | Zero-dependency local database via better-sqlite3 |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Telegram Bot                        │
│          /register  /tip  /pool  /leaderboard …          │
└───────────────────────────┬──────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
       Tips            Wallets            Creators
    (SQLite)         (ethers.js          (SQLite)
                      HD node)
          └─────────────────┬──────────────────┘
                            ▼
               ┌────────────────────────┐
               │     SQLite Database    │
               │  rounds · tips ·       │
               │  creators · wallets ·  │
               │  sybil-flags           │
               └──────────┬─────────────┘
                          │
        ┌─────────────────┼────────────────┐
        ▼                 ▼                ▼
   PoolMonitor      RoundManager      SybilDetector
   (every 30 min)   (daily cron)      (rules + Claude)
        │                 │                │
        └─────────────────┼────────────────┘
                          ▼
             ┌────────────────────────┐
             │   Quadratic Allocator  │
             │  isqrt · 3× cap ·      │
             │  pool safety check     │
             └──────────┬─────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Pool wallet    IPFS report   Agent sig
      (ethers.js)   (web3.storage)  (Claude)
```

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A **Telegram bot token** ([@BotFather](https://t.me/BotFather))
- An **Anthropic API key** for Claude
- RPC endpoint URLs for at least one supported chain (Polygon, Arbitrum, or Tron)
- A **Web3.Storage token** for IPFS report publishing (optional)

---

## Installation

```bash
git clone https://github.com/ClawdHQ/Flow.git
cd Flow
npm install
```

---

## Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | Token from @BotFather |
| `ANTHROPIC_API_KEY` | ✅ | Key for Claude sybil detection and round review |
| `ANTHROPIC_MODEL` | | Claude model name (default: `claude-sonnet-4-20250514`) |
| `WDK_SEED_PHRASE` | ✅ | BIP-39 mnemonic for HD wallet derivation |
| `WDK_ENCRYPTION_KEY` | ✅ | 32+ character string used as AES-256 encryption key |
| `POLYGON_RPC_URL` | | Polygon USDT RPC endpoint |
| `ARBITRUM_RPC_URL` | | Arbitrum USDT RPC endpoint |
| `TRON_RPC_URL` | | Tron USDT RPC endpoint |
| `WEB3_STORAGE_TOKEN` | | Token for IPFS report publishing |
| `ROUND_DURATION_HOURS` | | Length of each round in hours (default: `24`) |
| `ROUND_CRON` | | Cron expression for round start (default: `0 0 * * *`) |
| `MATCHING_POOL_MINIMUM` | | Minimum pool balance (USDT) to enable matching (default: `500`) |
| `MATCHING_POOL_BOOST_THRESHOLD` | | Pool balance above which multiplier is boosted (default: `5000`) |
| `SYBIL_WEIGHT_THRESHOLD` | | Tips below this weight are excluded from matching (default: `0.7`) |
| `PROTOCOL_FEE_BPS` | | Protocol fee in basis points, e.g. `100` = 1% (default: `100`) |
| `DB_PATH` | | SQLite database file path (default: `./flow.db`) |
| `DASHBOARD_PORT` | | Port for the web dashboard (default: `3000`) |
| `DASHBOARD_SECRET` | | Optional bearer token to protect the dashboard API |

> **Security:** Never commit your `.env` file. The seed phrase controls all HD-derived wallets including the matching pool.

---

## Running Flow

### Development (auto-reload)

```bash
npm run dev
```

Starts the agent, bot, and pool monitor in watch mode using `tsx`. Any source file change triggers an automatic restart.

### Production

```bash
npm run build   # compile TypeScript → dist/
npm start       # run compiled output
```

### Dashboard (separate process)

```bash
npm run dashboard
```

Starts the Express dashboard on `DASHBOARD_PORT` (default `3000`). The main agent and the dashboard can run concurrently.

### Utilities

```bash
npm run simulate    # run a test round with sample tip data (no live chain)
npm run seed-pool   # initialize pool wallet funding
```

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message and command reference |
| `/register <wallet> [chain]` | Register as a creator with a payout wallet address. `chain` defaults to `polygon`. |
| `/tip @username <amount> [msg]` | Send a tip (in USDT) to a registered creator. |
| `/pool` | Show current pool balance, multiplier, and health status. |
| `/leaderboard` | Display current round standings with quadratic scores. |
| `/history` | View your sent and received tip history. |
| `/withdraw` | Withdraw accrued earnings to your registered payout address. |
| `/status` | Show current round number, status, and total tippers. |

---

## Web Dashboard

The dashboard exposes a read-only REST API for monitoring:

| Endpoint | Description |
|---|---|
| `GET /api/round` | Current round data (status, totals, multiplier) |
| `GET /api/leaderboard` | Creator rankings with quadratic scores |
| `GET /api/pool` | Pool balance and health metrics |

The dashboard enforces rate limiting (60 requests per minute per IP). Set `DASHBOARD_SECRET` to require a `Bearer` token on all endpoints.

---

## Testing

Flow uses [Vitest](https://vitest.dev/) for unit tests.

```bash
npm test           # run all tests once
npm run test:watch # interactive watch mode
```

Tests cover:
- **Quadratic math** (`tests/quadratic.test.ts`) — `isqrt` correctness across 0–1M, many-small vs. few-large tip scenarios, the 3× cap, pool safety invariant, and empty-round handling.
- **Round manager** (`tests/round-manager.test.ts`) — round lifecycle state transitions and execution logic.
- **Sybil detection** (`tests/sybil.test.ts`) — rule-based scoring accuracy.
- **Wallet management** (`tests/wallet.test.ts`) — HD derivation paths and key encryption/decryption.

---

## Project Structure

```
Flow/
├── src/
│   ├── agent/
│   │   ├── index.ts            # Bootstrap: DB, bot, monitor, cron
│   │   ├── round-manager.ts    # Round execution lifecycle
│   │   ├── pool-monitor.ts     # Pool health checks & multiplier logic
│   │   ├── evaluator.ts        # Tip stats and projected match calcs
│   │   ├── sybil.ts            # Rule-based + LLM sybil detection
│   │   └── prompts.ts          # Claude prompt templates
│   │
│   ├── quadratic/
│   │   ├── index.ts            # isqrt(), computeQuadraticScore(), computeAllocations()
│   │   ├── allocator.ts        # Round-level allocation helpers
│   │   └── simulator.ts        # Simulation utilities
│   │
│   ├── wallet/
│   │   ├── index.ts            # WalletManager (HD derivation, AES encryption)
│   │   ├── pool.ts             # Pool wallet interface
│   │   ├── creator.ts          # Creator wallet derivation
│   │   ├── escrow.ts           # Per-tip escrow wallets
│   │   └── router.ts           # Transaction routing by chain
│   │
│   ├── bot/
│   │   ├── index.ts            # Bot factory and command wiring
│   │   ├── commands/           # One file per command handler
│   │   └── middleware/         # Rate limiter and request logger
│   │
│   ├── storage/
│   │   ├── db.ts               # better-sqlite3 initialization
│   │   ├── schema.ts           # Table DDL and migrations
│   │   └── repositories/       # rounds, tips, creators, wallets, sybil-flags
│   │
│   ├── dashboard/
│   │   ├── server.ts           # Express API server
│   │   └── index.html          # Dashboard frontend
│   │
│   ├── ipfs/
│   │   └── publisher.ts        # Publish round reports to web3.storage
│   │
│   ├── config/
│   │   ├── index.ts            # Zod env schema validation
│   │   └── chains.ts           # Per-chain RPC and token config
│   │
│   └── utils/
│       ├── logger.ts           # Pino structured logger
│       ├── math.ts             # USDT unit conversions
│       └── retry.ts            # Exponential backoff helper
│
├── scripts/
│   ├── simulate-round.ts       # End-to-end round simulation (no live chain)
│   ├── seed-pool.ts            # Pool initialization helper
│   └── deploy-contracts.ts     # Smart contract deployment placeholder
│
├── tests/
│   ├── quadratic.test.ts
│   ├── round-manager.test.ts
│   ├── sybil.test.ts
│   └── wallet.test.ts
│
├── .env.example                # Environment variable template
├── package.json
└── tsconfig.json
```

### HD Wallet Derivation Paths

| Wallet type | BIP-44 path |
|---|---|
| Matching pool | `m/44'/60'/0'/0/0` |
| Creator payout (index *n*) | `m/44'/60'/1'/0/n` |
| Tip escrow (index *n*) | `m/44'/60'/2'/0/n` |

---

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Make your changes and add or update tests as needed.
4. Run `npm test` to verify all tests pass.
5. Run `npm run build` to confirm there are no TypeScript errors.
6. Open a pull request with a clear description of your change.
