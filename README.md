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
- chain-native auth endpoints for EVM, TRON, BTC, and TON
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

- `POST /api/auth/:family/challenge`
- `POST /api/auth/:family/verify`
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

The OpenClaw/WDK skill definition lives in [src/openclaw-skill.md](/Users/ginmax/Flow/src/openclaw-skill.md).

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
- `auth_challenges`
- `auth_sessions`

## Demo Mode

The repo is designed to remain usable without every external credential or network integration.

When live adapters are unavailable, Flow enters explicit demo mode for that capability:

- no unsigned pool-release path is exposed
- signed settlement planning still happens
- bridge/direct receipts still get recorded
- pages and APIs continue to work

Relevant capability flags include:

- `FLOW_ENABLE_LIVE_ERC4337`
- `FLOW_ENABLE_LIVE_USDT0_BRIDGE`
- `FLOW_ENABLE_LIVE_PRICE_RATES`
- `FLOW_ENABLE_LIVE_INDEXER`
- `FLOW_ENABLE_LIVE_BTC_WALLET`
- `FLOW_ENABLE_LIVE_TON_WALLET`
- `FLOW_ENABLE_LIVE_TRON_GASFREE`

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

## Tracks

- Tipping Bot
- Agent Wallets
- Best Project Overall
