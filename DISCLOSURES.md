# Third-Party Services & Components

## APIs and Services

| Service | Purpose | Required |
|---|---|---|
| Telegram Bot API (via Grammy) | User-facing interface | Yes |
| Anthropic Claude API | Sybil detection + round review | Yes (or OpenRouter) |
| OpenRouter API | Alternative LLM provider | Optional fallback |
| Web3.Storage (IPFS) | Immutable round report archival | Optional |

## Blockchain Infrastructure

| Network | Chain ID | Use |
|---|---|---|
| Polygon (mainnet) | 137 | Primary USD₮ transfers |
| Polygon Amoy (testnet) | 80002 | Development and demo |
| Arbitrum One (mainnet) | 42161 | Secondary USD₮ transfers |
| Arbitrum Sepolia (testnet) | 421614 | Development and demo |
| TRON (mainnet) | N/A | Creator payouts |
| TRON Nile (testnet) | N/A | Development and demo |

## Open Source Packages

All dependencies listed in `package.json`. Key packages:

- `@tetherto/wdk` — Tether WDK orchestrator — core hackathon requirement
- `@tetherto/wdk-wallet-evm` — Tether WDK EVM wallet module (Polygon, Arbitrum)
- `@anthropic-ai/sdk` — Claude API client (also used for OpenRouter via baseURL)
- `grammy` — Telegram Bot framework
- `better-sqlite3` — Local database
- `ethers` — EVM transaction building (used via WDK)
- `pino` — Structured logging
- `zod` — Runtime config validation
- `@web3-storage/w3up-client` — IPFS publishing (w3up protocol)

## Pre-Existing Code

The quadratic funding mathematical model is based on the public Gitcoin CLR/QF
specification (https://wtfisqf.com). All implementation is original.
No prior code base was used — this project was built during the hackathon period.
