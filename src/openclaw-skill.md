---
name: flow-rumble-quadratic-tipping
description: |
  FLOW is a Rumble-native quadratic tipping agent built on top of the
  Rumble / Tether WDK wallet stack. It turns watch milestones, milestone
  events, super chats, and mirrored native tips into programmable
  community support, then distributes matching funds through autonomous
  round settlement.
version: 2.0.0
platform: Rumble (rumble.com)
chains: [ethereum, polygon, arbitrum, avalanche, celo, tron]
tokens: [USDT, XAUT, USAT, BTC]
---

## Core Rumble Actions

### handle_watch_event
Process a watch progress or completion event and fire an eligible auto-tip.

Input:
`{ viewer_id: string, creator_id: string, watch_percent: number, video_id?: string, session_id?: string }`

Output:
`{ tipped: boolean, amount?: string, token?: string, tx_hash?: string, reason: string }`

### handle_milestone
Process a livestream milestone and release a configured pool-funded bonus.

Input:
`{ creator_id: string, milestone_type: string, milestone_value: number }`

Output:
`{ bonus_released: boolean, amount?: string, token?: string, tx_hash?: string }`

### handle_super_chat
Mirror a Rumble super chat into FLOW's quadratic ledger using token-specific weighting.

Input:
`{ creator_id: string, viewer_id: string, amount_usd_cents: number, token: "USDT"|"XAUT"|"BTC", message?: string }`

Output:
`{ mirrored: boolean, effective_amount?: string, split_summary?: object }`

### handle_native_tip
Mirror a completed Rumble-native tip into FLOW's quadratic ledger.

Input:
`{ creator_id: string, viewer_id: string, amount_base_units: string, token: "USDT"|"XAUT"|"BTC", tx_hash: string }`

Output:
`{ mirrored: boolean, normalized_amount?: string, effective_amount?: string }`

## Configuration Actions

### configure_auto_tip
Set up a viewer's daily auto-tip policy.

Input:
`{ viewer_id: string, budget_per_day: string, tip_on_half_watch?: string, tip_on_complete?: string, token?: "USDT"|"XAUT"|"USAT" }`

Output:
`{ rule_id: string, enabled: boolean }`

### configure_split
Set a creator split across creator, pool, protocol, and collaborators.

Input:
`{ creator_id: string, creator_pct: number, collaborators?: [{ address: string, chain: string, pct: number }] }`

Output:
`{ split_id: string, creator_pct: number, pool_pct: number, protocol_pct: number }`

## Standard FLOW Actions

### tip_creator
Create a manual bot tip and return an escrow deposit address.

### register_creator
Register a payout-capable FLOW creator profile and preferred chain.

### get_pool_status
Return balance, multiplier, and depletion guidance for the community pool.

### get_leaderboard
Return creators ranked by quadratic score and community breadth.

### withdraw_earnings
Withdraw creator funds from the accumulation wallet.

## Architecture Notes

- All tip sources are normalized into a shared quadratic round ledger.
- XAU₮ carries a 2× prestige multiplier in the matching ledger.
- BTC carries a 3× prestige multiplier in the matching ledger.
- Rumble webhook events drive AutoTipAgent and EventTriggerAgent execution.
- Settlement uses agent review plus signed pool-release intent before execution.
