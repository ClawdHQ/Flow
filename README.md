# Flow

Flow is an autonomous quadratic tipping agent built on top of Rumble's Tether WDK wallet stack.

The core idea is simple:

- 50% watch time fires a `$0.10 USD₮` auto-tip.
- Video completion fires `$0.25 USD₮`.
- Every tip joins a 24-hour round.
- Matching uses quadratic math: `score = (sum of square roots of each tip)^2`.
- The same `$100` creates radically different outcomes depending on community breadth.

`1000` viewers tipping `$0.10` each produce `62.5x` more matching allocation than one person tipping `$100`.

## Submission Summary

Short description:

> Flow: autonomous quadratic tipping on Rumble. 1000 fans watching beats any whale. WDK-powered, onchain.

Description:

> Flow turns passive watching into programmable community funding. When a viewer hits 50% watch time on a Rumble video, Flow fires a `$0.10 USD₮` auto-tip. Completion fires `$0.25`. These tips join a 24-hour round, quadratic scores are computed, and an AI agent autonomously settles the matching pool across creators. The pool wallet cannot release funds without a cryptographic signature over the exact allocation plan hash. Creators get a portal for revenue splits, a live OBS overlay, and Telegram settlement notifications. XAU₮ tips carry `2x` quadratic weight. BTC carries `3x`. MoonPay on-ramp and off-ramp are integrated.

## What Changed In This Rebuild

This repo now models the product as a multi-family wallet system instead of an EVM/TRON-only demo:

- wallet families: `evm`, `evm_erc4337`, `tron_gasfree`, `btc`, `ton`, `ton_gasless`
- canonical settlement plans with deterministic JSON hashing
- signature-gated pool execution
- bridge planning for EVM-to-EVM payouts
- payout destinations and creator admin wallets as first-class records
- single-path seed-phrase auth connect endpoint for EVM, TRON, BTC, and TON
- live overlay updates over WebSocket
- creator portal APIs for splits, payout preferences, and overlay settings
- report attestations with both plan-hash and CID signatures

## Architecture

```text
Rumble webhooks
  -> AutoTipAgent / EventTriggerAgent
  -> SQLite ledger of tips, creators, rounds, rates, auth, and execution receipts
  -> SybilDetector
  -> CanonicalSettlementPlan
  -> plan hash + pool signature
  -> direct payouts or bridge actions
  -> IPFS report + CID signature
  -> Telegram settlement notifications
  -> WebSocket overlay events
```

## Wallet Stack

Current code is structured for the full WDK-driven target architecture:

- `@tetherto/wdk`
- `@tetherto/wdk-wallet-evm`
- `@tetherto/wdk-wallet-tron`
- ERC-4337 pool-wallet semantics
- USDT0 bridge planning for EVM-to-EVM payouts
- Price-rate snapshots for XAU₮ and BTC normalization
- MoonPay buy/sell support

Some families remain explicit demo-mode adapters unless the relevant live capability flags are enabled. The runtime surfaces that capability state instead of silently pretending everything is live.

## Supported Networks

- Bitcoin via Electrum, BIP-84 native SegWit
- Ethereum mainnet and Sepolia
- Polygon mainnet and Amoy
- Arbitrum One and Sepolia
- Avalanche C-Chain and Fuji
- Celo mainnet and Sepolia
- TON mainnet and testnet
- TRON mainnet and Nile

## Agents

Flow keeps four backend agent roles first-class:

- `AutoTipAgent`
- `EventTriggerAgent`
- `SybilDetector`
- `RoundManager`

The intelligence layer uses Claude via `@anthropic-ai/sdk` with OpenRouter fallback.

## Creator Portal and Overlay

The web app is now one Express surface serving:

- `/` landing page
- `/creator` creator portal
- `/overlay/:handle` OBS/browser-source overlay
- `/present` presentation deck
- `/dashboard` operations dashboard

Portal APIs:

- `POST /api/auth/seed`
- `POST /api/auth/connect`
- `POST /api/auth/logout`
- `GET /api/creator/me`
- `PUT /api/creator/splits`
- `PUT /api/creator/payout`
- `PUT /api/creator/overlay`
- `GET /api/overlay/:handle/state`
- `GET /api/rounds/:id/report`

Overlay transport:

- `WS /ws/overlay/:handle`

## Agent Skill Surface

The OpenClaw/WDK skill definition lives in [src/openclaw-skill.md](src/openclaw-skill.md).

Paid agent-facing skill routes sit behind a simple x402-style gate:

- `POST /api/agent/skill/:action`

## Database

Persistent state uses SQLite via `better-sqlite3`.

Important tables now include:

- `rounds`
- `tips`
- `creators`
- `wallet_accounts`
- `creator_admin_wallets`
- `payout_destinations`
- `creator_overlay_settings`
- `rate_snapshots`
- `round_allocations`
- `bridge_transfers`
- `settlement_executions`
- `report_attestations`
- `telegram_notifications`
- `auth_sessions`

## Local Development

```bash
npm install
npm run build
npm test
npm run dev
```

The dev runner starts:

- agent runtime
- web/dashboard server

Useful URLs:

- `http://localhost:3000/`
- `http://localhost:3000/creator`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/present`

## Complete User Flow

### Creator Flow (End-to-End)

1. Onboarding
- Creator opens landing page and goes to `/login`.
- Creator generates or imports a seed phrase.
- Creator confirms seed backup and selects a wallet family.

2. Authentication
- Client calls `POST /api/auth/connect` with `family`, `network`, and `seedPhrase`.
- If username is missing, creator completes the inline username step and retries.
- Session token is issued and creator is redirected to `/creator`.

3. Creator Setup
- Portal loads creator profile through `GET /api/creator/me`.
- Creator configures split rules with `PUT /api/creator/splits`.
- Creator sets payout destination with `PUT /api/creator/payout`.
- Creator customizes overlay settings with `PUT /api/creator/overlay`.

4. Live Round Participation
- Audience watch events generate tipping intents.
- Tips are recorded in active round state and contribute to quadratic scoring.
- Creator monitors progress from `/dashboard` and overlay state.

5. Settlement and Reporting
- Round manager closes round and computes allocations.
- Canonical plan hash + pool signature gate execution.
- Settlement artifacts, attestations, and notifications are persisted.

### Tipper (Audience) Flow (End-to-End)

1. Viewer Watches Content
- Viewer starts a Rumble session for a creator.
- Event trigger pipeline tracks watch milestones.

2. Automatic Tip Events
- At 50% watch threshold, Flow records auto-tip (for example 0.10 USDT).
- At completion threshold, Flow records second auto-tip (for example 0.25 USDT).
- Optional manual tipping can be added to the same round where applicable.

3. Round Contribution and Matching
- Tips are attributed to creator + round.
- Quadratic allocation favors broad participation over single large contributors.
- Viewer impact is reflected in round-level allocation reports after settlement.

4. Post-Round Visibility
- Audience can see creator overlay momentum and final outcomes.
- System stores receipts for auditability and trust.

## Vercel Live Deployment

### 1. Prepare Release Branch

```bash
git checkout -b release/vercel-live
npm install
npm run build
npm test
```

### 2. Push to Git Provider

```bash
git add .
git commit -m "chore: prepare vercel live deployment"
git push origin release/vercel-live
```

### 3. Create Vercel Project

1. Import repository in Vercel.
2. Select Next.js framework preset.
3. Set production branch.
4. Keep root directory at repository root.

### 4. Configure Production Environment Variables

Set these in Vercel Project Settings:

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL=https://your-live-domain.com`
- `FLOW_AUTH_SECRET=<strong-random-secret>`
- `FLOW_SEED_ENCRYPTION_KEY=<strong-random-secret>`
- Add any wallet/Telegram/MoonPay/IPFS keys required by enabled features.

### 5. Storage Warning (Important)

Flow currently uses SQLite by default. Vercel serverless filesystem is ephemeral.

For real production persistence, migrate to a managed data store (for example Turso, Neon, or Postgres) and point Flow repositories to that backend.

### 6. Deploy and Verify

- Trigger first production deployment in Vercel.
- Confirm these routes load on live domain:
  - `/`
  - `/login`
  - `/creator`
  - `/dashboard`
  - `/api/auth/session`

### 7. Configure External Callbacks to Live URL

Update any integrations/webhooks to use the production base URL:

- `https://your-live-domain.com/api/...`

Typical integrations to update:

- Rumble webhooks
- Telegram callbacks
- Any bridge/wallet callback routes

### 8. Optional Vercel CLI Deployment

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

## Tech

- TypeScript, NodeNext, strict mode
- Express
- SQLite with `better-sqlite3`
- Grammy
- Vitest
- WDK wallet stack
- Anthropic SDK + OpenRouter fallback
- WebSocket overlay transport via `ws`
- TON proof helpers via `@ton/core` and `@ton/crypto`
- BTC BIP-322 verification via `bip322-js`

## Supabase Database Setup

Flow uses a **dual-path** database strategy:

| Environment | Database | Location |
|---|---|---|
| Local development | SQLite via `better-sqlite3` | `./data/flow.db` |
| Production (Vercel) | Supabase PostgreSQL | Managed cloud |

### 1. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Settings → API** copy **Project URL** and **service_role key** (keep this secret — server-side only).

### 2. Run the migration

Open the **SQL Editor** in your project and paste the contents of
[`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
This creates all tables, indexes and the `audience_members` profile table.

Alternatively, if you have the Supabase CLI:

```bash
supabase db push
```

### 3. Set environment variables

Add these to your `.env.local` (and to Vercel → Settings → Environment Variables):

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

> **Note:** The service role key bypasses Row Level Security and should never be
> exposed client-side. Next.js API routes run server-side, so this is safe.

### 4. How dual-path works

Every `app/api/audience/` route checks `isSupabaseConfigured()` at runtime:

```
SUPABASE_URL set?
  ├── Yes → use Supabase async helpers (sbInsert / sbFindMany / …)
  └── No  → fall through to SQLite repositories (unchanged)
```

The agent runtime (`src/`) always uses SQLite directly — Supabase is only used by
the Next.js server layer and the audience-facing API.

## Tracks

- Tipping Bot
- Agent Wallets
- Best Project Overall
