# FLOW — Quadratic Tipping Agent on Rumble
## Hackathon Galáctica: WDK Edition 1 | Tipping Bot Track

Flow is a Rumble-native autonomous agent that transforms watch-time, milestones, and direct tips into programmable community support. Every qualifying contribution lands in a daily quadratic round, where broad audience participation beats concentrated whale capital.

## One-Line Pitch

Flow turns every viewer's watch time into a programmable tip, then quadratically multiplies community support so 1000 fans tipping $0.10 each outweigh one whale tipping $100.

## The Problem

Rumble already has a WDK-powered tipping wallet, but today's tipping flow is still manual and whale-biased:

- Passive viewers rarely tip because leaving the stream to pay interrupts the moment.
- A single $100 tip and 1000 $0.10 tips look identical in a linear system even though the community signal is completely different.
- Matching pools need human operators to decide who gets what and when.
- There is no programmable logic for watch-time rewards, milestone bonuses, or collaborator splits.

Creators with real audience breadth are undervalued by a system that cannot read community support as a signal.

## The Solution

Flow sits on top of Rumble's WDK wallet as an autonomous agent layer.

### 1. Watch-Time Auto-Tips

When Rumble sends `video.watch_progress` or `video.watch_completed`, Flow can fire micro-tips automatically:

- 50% watch milestone: default `0.10 USD₮`
- completion milestone: default `0.25 USD₮`
- per-viewer daily budgets and token preferences via `/autotip`

The viewer never pauses the content. The creator still gets paid. Passive watching becomes active economic participation.

### 2. Quadratic Matching

All tip sources flow into the same 24-hour quadratic round:

```text
score(creator) = ( Σ √tip_amount_i )²
match(creator) = pool × score / Σ all_scores
```

The engine is BigInt-safe and breadth-biased. Many small contributions outperform one large tip of the same total value.

### 3. Autonomous Settlement

The round manager locks the round, analyzes tips, reviews the allocation plan, signs it, executes transfers, archives the report, and opens the next round without human intervention.

## What Makes Flow Different

| Standard Rumble Tip | Flow on Rumble |
|---|---|
| Manual payment action | Automatic watch-time triggers |
| Whale-biased | Community-biased quadratic matching |
| Point-to-point transfer | Split-aware creator / pool / protocol accounting |
| One-time value | Daily matching on top of direct support |
| Human-managed pool ops | Autonomous round execution |
| Single-token mental model | USD₮, XAU₮, USA₮, BTC-aware ledger |

## Technical Architecture

```text
Rumble Platform Events
  (watch, milestone, super_chat, tip.completed)
           │
           ▼
  POST /rumble/webhook
  (HMAC-verified, async routed)
           │
     ┌─────┴──────────────────────────────────┐
     ▼                                        ▼
AutoTipAgent                        EventTriggerAgent
(watch_progress → micro-tip)        (milestone → pool bonus)
(watch_completed → bonus tip)       (super_chat → weighted tip)
     │                              (tip.completed → mirror)
     └─────────────┬────────────────────────────┘
                   ▼
         Quadratic Round Ledger
         (SQLite · all tip sources)
                   │
                   ▼
          RoundManager Agent
    (Lock → Analyze → Review → Sign → Execute → Archive)
                   │
         ┌─────────┴──────────────┐
         ▼                        ▼
   WDK Wallet Layer          IPFS Archive
 (@tetherto/wdk              (signed round
  + wdk-wallet-evm)           report + agent
  Pool · Creator · Escrow     attestation)
```

## WDK Integration

Flow uses `@tetherto/wdk`, `@tetherto/wdk-wallet-evm`, and `@tetherto/wdk-wallet-tron` across its supported chains.

- Pool wallet: `m/44'/60'/0'/0/0`
- Creator wallets: `m/44'/60'/1'/0/N`
- Escrow wallets: `m/44'/60'/2'/0/N`

The round manager signs an allocation plan hash before pool releases occur. In the demo runtime this is represented with build-and-execute pool transactions plus agent signatures, keeping the settlement path aligned with the autonomous-signing model.

## OpenClaw Skill Surface

The OpenClaw skill definition lives in `src/openclaw-skill.md` and exposes the main Rumble-facing capabilities:

- `handle_watch_event`
- `handle_milestone`
- `configure_auto_tip`
- `configure_split`
- `tip_creator`
- `get_pool_status`
- `get_leaderboard`

## Sybil Protection

Every confirmed tip runs through two layers:

1. Rule-based checks for repeated creator targeting, abnormal velocity, and wallet-age style heuristics.
2. LLM review for borderline cases, using Anthropic directly or OpenRouter as fallback.

Tips remain visible even when suspicious, but their effective weight can be reduced before they reach the quadratic allocator.

## Token Support

| Token | Weight | Notes |
|---|---|---|
| USD₮ | 1.0× | Standard tip and auto-tip unit |
| XAU₮ | 2.0× | Premium-weight Rumble events and transfers |
| USA₮ | 1.0× | Registry-ready ledger token |
| BTC | 3.0× | Mirrored prestige tips in the quadratic ledger |

BTC is currently supported in mirrored Rumble-native accounting and prestige weighting; direct wallet sends remain explicitly disabled in the EVM wallet layer.

## Smart Revenue Splits

Flow supports creator-configurable split math:

- 85% creator
- 10% pool
- 1% protocol
- 4% reserved or collaborator-configurable

Creators manage this with `/split`. The split engine is used by Rumble-native event ingestion today and is designed to expand further across additional settlement paths.

## Agent Autonomy

Each round follows the same lifecycle:

```text
LOCK     → stop intake for the closing round
ANALYZE  → run batch sybil analysis
REVIEW   → LLM anomaly review on the allocation plan
SIGN     → hash plan and collect agent signature
EXECUTE  → settle escrows and release pool matches
ARCHIVE  → produce signed round report + IPFS metadata
RESET    → open the next round
```

## Rumble Demo Flow

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run simulate:rumble
```

The simulator emits a judge-friendly sequence of events:

- 20 viewers start watching
- 15 hit 50% watch time
- 10 complete the video
- a livestream milestone triggers a pool bonus
- 3 super chats arrive, including a premium XAU₮ event

Link a creator with `/rumble connect AliceOnRumble`, then open `http://localhost:3000` to watch the event feed, auto-tip activity, and quadratic leaderboard update in real time.

## Full Feature Set

### Core Protocol

- BigInt-safe quadratic allocator
- Autonomous round manager
- Pool multiplier monitoring
- HD escrow wallets per tip
- IPFS report publishing with agent attestation fields
- 3× cap on match relative to direct support

### Rumble Integration

- HMAC-verified webhook receiver
- watch-time auto-tip agent
- milestone bonus agent
- super chat mirroring with token weighting
- Rumble-native tip mirroring
- Rumble event simulator

### Wallet Infrastructure

- `@tetherto/wdk`
- `@tetherto/wdk-wallet-evm`
- `@tetherto/wdk-wallet-tron`
- Ethereum, Polygon, Arbitrum, Avalanche, Celo, TRON
- encrypted local key material
- mock transfer hashes in demo mode when live RPC/config is missing

### Intelligence

- sybil detection with LLM fallback
- round-plan review prompt before execution
- dynamic pool multiplier based on pool health

### Fiat On/Off-Ramp

- MoonPay-backed `/fiat`, `/buy`, and `/sell`

### Telegram Bot

Current command surface:

`/start` `/register` `/tip` `/deposit` `/balance` `/pool` `/round` `/rounds` `/leaderboard` `/sybil` `/history` `/withdraw` `/fiat` `/buy` `/sell` `/status` `/autotip` `/split` `/rumble`

### Dashboard

- live round stats
- pool health
- quadratic leaderboard
- sybil monitor
- Rumble event feed
- auto-tip and milestone activity

## Setup in 5 Minutes

```bash
git clone https://github.com/ClawdHQ/Flow.git
cd Flow
npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN plus ANTHROPIC_API_KEY or OPENROUTER_API_KEY
# Set WDK_SEED_PHRASE and WDK_ENCRYPTION_KEY
# USE_TESTNET=true is the default demo path
npm run dev
```

Then in another terminal:

```bash
npm run simulate:rumble
```

For Sepolia demo balances you can use the Pimlico faucet and the configured Pimlico USD₮ test token address.

## Tech Stack

| Layer | Technology |
|---|---|
| Wallet | `@tetherto/wdk` + WDK wallet modules |
| Bot | Grammy |
| Agent review | Anthropic / OpenRouter |
| Storage | better-sqlite3 |
| Dashboard API | Express |
| Archive | Web3.Storage-compatible IPFS flow |
| Fiat | MoonPay |
| Logging | Pino |
| Config | Zod |
| Tests | Vitest |
| Language | TypeScript |

## Third-Party Disclosures

See `DISCLOSURES.md` for the full list of third-party services and infrastructure.

## License

Apache 2.0 — see `LICENSE`
