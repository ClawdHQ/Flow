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
| **Multi-chain wallets** | HD derivation for Polygon, Arbitrum, and Tron via Tether WDK |
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
    (SQLite)         (Tether WDK         (SQLite)
                       + ethers)
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
      (Tether WDK)  (web3.storage)  (Claude)
```

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A **Telegram bot token** ([@BotFather](https://t.me/BotFather))
- **An LLM API key**: Either Anthropic (`ANTHROPIC_API_KEY`) OR OpenRouter (`OPENROUTER_API_KEY`)
  — OpenRouter has a free tier and supports Claude models
- **Tether WDK seed phrase** — A 12-word BIP-39 mnemonic. Generate one with Node.js:
  ```bash
  node -e "const {ethers}=require('ethers');console.log(ethers.Wallet.createRandom().mnemonic.phrase)"
  ```
  Or use any BIP-39 generator (e.g. https://iancoleman.io/bip39/ — use offline only).
  Set the output as `WDK_SEED_PHRASE` in your `.env`.
  ⚠️ This controls all wallets including the matching pool. Never commit it.
- RPC endpoint URLs for at least one supported chain (Polygon Amoy testnet works for demo)
- A **Web3.Storage token** for IPFS publishing (optional — set `IPFS_DISABLED=true` to skip)

---

## LLM Provider Setup

Flow supports two LLM providers. You need at least one.

### Option A: Anthropic (Recommended)
Get an API key at https://console.anthropic.com
Set `ANTHROPIC_API_KEY` in your `.env` file.

### Option B: OpenRouter (Free Tier Available)
OpenRouter provides access to Claude and 100+ other models.
Useful if you don't have direct Anthropic access.

1. Sign up at https://openrouter.ai
2. Create a key at https://openrouter.ai/keys
3. Set in your `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=anthropic/claude-sonnet-4
   ```
   Leave `ANTHROPIC_API_KEY` empty.

Recommended OpenRouter models for FLOW:
- `anthropic/claude-sonnet-4` — Best quality (same as direct Anthropic)
- `anthropic/claude-haiku-4` — Faster, cheaper, still great for sybil detection
- `mistralai/mistral-large` — Good alternative if Claude credits are limited
- `google/gemini-2.0-flash` — Fast and cheap option

> Note: Free tier models on OpenRouter have rate limits. For production use,
> add credits to your OpenRouter account.

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
| `ANTHROPIC_API_KEY` | ✅* | Key for Claude sybil detection and round review |
| `ANTHROPIC_MODEL` | | Claude model name (default: `claude-sonnet-4-20250514`) |
| `OPENROUTER_API_KEY` | ✅* | OpenRouter key (alternative to Anthropic — free tier available) |
| `OPENROUTER_MODEL` | | OpenRouter model ID (default: `anthropic/claude-sonnet-4`) |
| `ADMIN_TELEGRAM_ID` | | Your Telegram numeric user ID — restricts `/status` to admin only |
| `WDK_SEED_PHRASE` | ✅ | BIP-39 mnemonic for HD wallet derivation (via Tether WDK) |
| `WDK_ENCRYPTION_KEY` | ✅ | 32+ character string used as AES-256 encryption key |
| `USE_TESTNET` | | Set `true` to use testnet chains for demo (default: `false`) |
| `POLYGON_RPC_URL` | | Polygon mainnet USDT RPC endpoint |
| `POLYGON_AMOY_RPC_URL` | | Polygon Amoy testnet RPC (default: public endpoint) |
| `ARBITRUM_RPC_URL` | | Arbitrum One USDT RPC endpoint |
| `ARBITRUM_SEPOLIA_RPC_URL` | | Arbitrum Sepolia testnet RPC (default: public endpoint) |
| `TRON_RPC_URL` | | Tron USDT RPC endpoint |
| `WEB3_STORAGE_TOKEN` | | Token for IPFS report publishing |
| `IPFS_DISABLED` | | Set `true` to skip IPFS upload for local demo (default: `false`) |
| `ROUND_DURATION_HOURS` | | Length of each round in hours (default: `24`) |
| `ROUND_CRON` | | Cron expression for round start (default: `0 0 * * *`) |
| `MATCHING_POOL_MINIMUM` | | Minimum pool balance (USDT) to enable matching (default: `500`) |
| `MATCHING_POOL_BOOST_THRESHOLD` | | Pool balance above which multiplier is boosted (default: `5000`) |
| `SYBIL_WEIGHT_THRESHOLD` | | Tips below this weight are excluded from matching (default: `0.7`) |
| `PROTOCOL_FEE_BPS` | | Protocol fee in basis points, e.g. `100` = 1% (default: `100`) |
| `DB_PATH` | | SQLite database file path (default: `./flow.db`) |
| `DASHBOARD_PORT` | | Port for the web dashboard (default: `3000`) |
| `DASHBOARD_SECRET` | | Optional bearer token to protect the dashboard API |

> ✅* Either `ANTHROPIC_API_KEY` **or** `OPENROUTER_API_KEY` must be set — at least one is required.

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
| `GET /api/round/current` | Current round data (status, totals, multiplier) |
| `GET /api/round/leaderboard` | Creator rankings with quadratic scores |
| `GET /api/pool` | Pool balance and health metrics |
| `GET /api/sybil/flags` | Sybil flags for the current round |
| `GET /api/rounds` | Last 20 completed rounds history |

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

---

## Known Limitations

- **Demo mode transfers**: When no live RPC is configured (e.g. during local simulation),
  `sendUSDT()` returns a deterministic mock transaction hash instead of a real on-chain
  transaction. All bot messages clearly indicate when demo mode is active. To enable
  real transfers, configure `POLYGON_AMOY_RPC_URL` and fund the pool wallet with test
  USDt from [pimlico.io/faucet](https://www.pimlico.io/faucet).

- **TRON support**: TRON creator payout routing is config-present but not yet wired to
  `@tetherto/wdk-wallet-tron`. Creators selecting TRON as their payout chain will
  receive funds on Polygon until TRON module integration is complete.

- **IPFS archival**: When `IPFS_DISABLED=true` or no `WEB3_STORAGE_TOKEN` is set,
  round reports are published with a deterministic mock CID. The signing and
  attestation logic runs identically — only the actual IPFS upload is skipped.

- **Sybil clustering detection**: The network clustering check (detecting 2-hop shared
  funding sources) requires an archive RPC node. Standard public testnet RPCs may not
  support `eth_getTransactionByHash` lookups for older blocks. In this case the
  clustering check is skipped and only wallet age + velocity checks run.

- **Round frequency**: The default `ROUND_CRON=0 0 * * *` runs rounds daily at midnight.
  For demo purposes, trigger a manual round with `npm run simulate` which executes
  the full allocation pipeline without waiting for the cron schedule.

- **Single-process deployment**: The bot, round manager, and pool monitor all run in
  one Node.js process. For production scale, these should be separated into independent
  workers with a shared database.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Make your changes and add or update tests as needed.
4. Run `npm test` to verify all tests pass.
5. Run `npm run build` to confirm there are no TypeScript errors.
6. Open a pull request with a clear description of your change.
