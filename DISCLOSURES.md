# Third-Party Services & Components

## APIs and Services

| Service | Purpose | Required |
|---|---|---|
| Telegram Bot API (via Grammy) | Creator/admin command surface | Yes |
| Rumble Platform API | Creator/video metadata and webhook event source | Optional |
| Rumble WDK Wallet | Underlying wallet infrastructure FLOW extends | Yes |
| Anthropic Claude API | LLM sybil analysis and round-plan review | Yes, unless OpenRouter is used instead |
| OpenRouter API | Compatible fallback LLM provider | Optional fallback |
| Web3.Storage | IPFS publishing for round reports | Optional |
| MoonPay | Fiat on-ramp and off-ramp flows | Optional |
| CoinGecko API | Live token normalization rates for XAU₮ and BTC | Optional with env override fallback |

## Blockchain Infrastructure

| Network | Use |
|---|---|
| Ethereum | mainnet USD₮ / XAU₮ / USA₮ routing |
| Ethereum Sepolia | default testnet demo path |
| Polygon | mainnet creator and pool routing |
| Polygon Amoy | testnet demo path |
| Arbitrum One | mainnet routing |
| Arbitrum Sepolia | testnet routing |
| Avalanche C-Chain | mainnet routing |
| Avalanche Fuji | testnet routing |
| Celo | mainnet routing |
| Celo Sepolia | testnet routing |
| TRON | mainnet payout routing |
| TRON Nile | testnet routing |

## Open Source Packages

Key dependencies from `package.json`:

- `@tetherto/wdk`
- `@tetherto/wdk-wallet-evm`
- `@tetherto/wdk-wallet-tron`
- `@anthropic-ai/sdk`
- `grammy`
- `better-sqlite3`
- `ethers`
- `express`
- `node-cron`
- `pino`
- `zod`
- `@web3-storage/w3up-client`

## Disclosure Notes

- FLOW is built on top of Tether's WDK stack and does not replace it.
- Rumble integration works in demo mode without a live Rumble API key via the local simulator.
- BTC prestige weighting is supported in quadratic accounting today, while direct BTC wallet sends are still intentionally disabled in the current wallet implementation.
