---
name: flow-rumble-autonomous-quadratic-tipping
description: |
  Flow is an autonomous quadratic tipping system built on top of Rumble's
  Tether WDK wallet stack. It converts watch milestones and native tipping
  activity into quadratic funding rounds, computes breadth-weighted matching,
  signs a canonical settlement plan hash, and routes creator payouts across
  EVM, TRON, Bitcoin, and TON destinations.
version: 3.0.0
platform: Rumble (rumble.com)
chains: [bitcoin, ethereum, polygon, arbitrum, avalanche, celo, tron, ton]
tokens: [USDT, XAUT, USAT, BTC]
---

## Core Actions

### handle_watch_event
Process a watch progress or completion event and fire an eligible auto-tip.

Input:
`{ viewer_id: string, creator_id: string, creator_rumble_handle: string, watch_percent: number, video_id?: string, session_id?: string, event_id: string }`

Output:
`{ tipped: boolean, reason: string }`

### handle_milestone
Process a livestream milestone and release a configured pool-funded bonus.

Input:
`{ event_id: string, creator_id: string, creator_rumble_handle: string, milestone_type: "viewer_count"|"subscriber_count"|"tip_total", milestone_value: number }`

Output:
`{ bonus_released: boolean, token?: string, tx_hash?: string }`

### handle_super_chat
Mirror a Rumble super chat into Flow's quadratic ledger using token weighting.

Input:
`{ event_id: string, creator_id: string, creator_rumble_handle: string, viewer_id: string, amount_usd_cents: number, token: "USDT"|"XAUT"|"BTC", message?: string }`

Output:
`{ mirrored: boolean }`

### handle_native_tip
Mirror a completed Rumble-native tip into Flow's ledger.

Input:
`{ event_id: string, creator_id: string, creator_rumble_handle: string, viewer_id: string, amount_base_units: string, token: "USDT"|"XAUT"|"BTC", tx_hash: string, chain: string }`

Output:
`{ mirrored: boolean }`

## Configuration Actions

### configure_auto_tip
Set a viewer's daily auto-tip policy.

Input:
`{ viewer_id: string, creator_id?: string, budget_per_day: string, tip_on_half_watch?: string, tip_on_complete?: string, token?: "USDT"|"XAUT"|"USAT", chain?: string }`

### configure_split
Set a creator split across creator, pool, protocol, and collaborators.

Input:
`{ creator_id: string, creator_bps?: number, pool_bps?: number, protocol_bps?: number, collaborators?: [{ address: string, chain: string, bps: number }] }`

### configure_payout_destination
Set the creator payout destination used by settlement.

Input:
`{ creator_id: string, family: "evm"|"tron_gasfree"|"btc"|"ton_gasless", network: string, token: string, address: string }`

## Read Actions

### get_pool_status
Return pool balance, multiplier, projected usage, and depletion guidance.

### get_leaderboard
Return creators ranked by quadratic score and community breadth.

### get_round_report
Return the canonical settlement plan, execution receipts, and report attestation for a round.

## Runtime Notes

- Matching uses `score = (sum of sqrt(tip_i))^2`.
- XAU₮ carries `2x` weight.
- BTC carries `3x` weight.
- Pool settlement is gated by a cryptographic signature over the canonical plan hash.
- EVM-to-EVM payouts can be routed as bridge actions.
- Creator payout destinations are separate from creator admin auth wallets.
- OBS overlays subscribe to `WS /ws/overlay/:handle`.
- Agent-facing HTTP skill routes can be protected with an x402-style payment gate.
