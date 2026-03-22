---
name: flow-tipping
description: Quadratic tipping agent. Send USD₮ tips to creators on Telegram,
  query pool health, and view leaderboards. Tips unlock quadratic matching from
  the community pool. Many small tips beat one large tip.
---

## Available Actions

### tip_creator
Send a tip to a registered creator.
Parameters: `{ username: string, amount_usdt: number, message?: string }`
Response: `{ escrow_address: string, chain: string, expires_in: string, projected_match: string }`

### get_pool_status
Get current pool balance, multiplier, and round stats.
Parameters: `{}`
Response: `{ balance: string, multiplier: number, round_number: number, closes_in: string }`

### get_leaderboard
Get top creators by quadratic score for the current round.
Parameters: `{ limit?: number }`
Response: `{ creators: [{ username, unique_tippers, direct_tips, projected_match, score }] }`

## Notes
- All amounts in USD₮ (6 decimal places internally, human-readable in responses)
- Tips expire after 30 minutes if deposit not confirmed on-chain
- Matching pool distributes at the end of each 24-hour round
