-- Flow – Supabase (PostgreSQL) schema
-- Run this in the Supabase SQL editor or via `supabase db push`.
-- All tables mirror the SQLite schema exactly so both databases can be used
-- concurrently during migration.  SQLite-specific syntax has been converted:
--   randomblob → gen_random_uuid()
--   datetime('now') → NOW()
--   REAL → DOUBLE PRECISION
--   INTEGER booleans → kept as INTEGER for drop-in parity
--   IFNULL → COALESCE

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Helper: lowercase hex UUID (matches existing SQLite ID format) ───────────
-- Use gen_random_uuid() which returns a proper UUID; strip the hyphens for
-- compatibility with the 32-char hex IDs this app generates.
-- If you prefer UUID primary keys natively, change TEXT → UUID and remove the
-- replace() wrapper.

-- ─── Rounds ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rounds (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_number        INTEGER UNIQUE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  matching_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  total_direct_tips   TEXT NOT NULL DEFAULT '0',
  total_matched       TEXT NOT NULL DEFAULT '0',
  pool_used           TEXT NOT NULL DEFAULT '0',
  ipfs_cid            TEXT,
  ipfs_url            TEXT,
  plan_hash           TEXT,
  plan_json           TEXT,
  plan_signature      TEXT,
  cid_signature       TEXT,
  pool_wallet_address TEXT,
  agent_signature     TEXT,
  tipper_count        INTEGER NOT NULL DEFAULT 0,
  creator_count       INTEGER NOT NULL DEFAULT 0,
  sybil_flags_count   INTEGER NOT NULL DEFAULT 0
);

-- ─── Creators ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creators (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  telegram_id                 TEXT UNIQUE NOT NULL,
  username                    TEXT UNIQUE NOT NULL,
  payout_address              TEXT NOT NULL,
  preferred_chain             TEXT NOT NULL DEFAULT 'polygon',
  accumulation_wallet_address TEXT,
  accumulation_wallet_path    TEXT,
  total_received              TEXT NOT NULL DEFAULT '0',
  total_matched               TEXT NOT NULL DEFAULT '0',
  round_count                 INTEGER NOT NULL DEFAULT 0,
  registered_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tips ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tips (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tip_uuid                 TEXT UNIQUE NOT NULL,
  round_id                 TEXT NOT NULL REFERENCES rounds(id),
  tipper_telegram_id       TEXT NOT NULL,
  tipper_wallet_address    TEXT,
  creator_id               TEXT NOT NULL REFERENCES creators(id),
  amount_usdt              TEXT NOT NULL,
  effective_amount         TEXT NOT NULL,
  chain                    TEXT NOT NULL DEFAULT 'polygon',
  token                    TEXT,
  amount_native            TEXT,
  source                   TEXT,
  external_event_id        TEXT,
  external_actor_id        TEXT,
  price_rate_snapshot_id   TEXT,
  escrow_address           TEXT,
  deposit_tx_hash          TEXT,
  settlement_tx_hash       TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending',
  sybil_weight             DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  sybil_confidence         DOUBLE PRECISION,
  sybil_flagged            INTEGER NOT NULL DEFAULT 0,
  sybil_reasons            TEXT,
  sybil_reasoning          TEXT,
  message                  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at             TIMESTAMPTZ,
  settled_at               TIMESTAMPTZ,
  protocol_fee             TEXT NOT NULL DEFAULT '0',
  pool_fee                 TEXT NOT NULL DEFAULT '0',
  creator_share            TEXT NOT NULL DEFAULT '0'
);

CREATE INDEX IF NOT EXISTS idx_tips_round_id    ON tips(round_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_id  ON tips(creator_id);
CREATE INDEX IF NOT EXISTS idx_tips_tipper_addr ON tips(tipper_wallet_address);

-- ─── Wallets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  address                TEXT NOT NULL,
  chain                  TEXT NOT NULL,
  wallet_type            TEXT NOT NULL,
  hd_path                TEXT NOT NULL,
  encrypted_key_material TEXT NOT NULL,
  reference_id           TEXT,
  balance_cached         TEXT,
  balance_updated_at     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (address, chain)
);

-- ─── Escrows ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrows (
  tip_id            TEXT PRIMARY KEY REFERENCES tips(id) ON DELETE CASCADE,
  derivation_index  INTEGER NOT NULL UNIQUE,
  address           TEXT NOT NULL,
  chain             TEXT NOT NULL,
  hd_path           TEXT NOT NULL,
  expected_amount   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  chat_id           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  confirmed_at      TIMESTAMPTZ,
  settled_at        TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escrows_status_expires ON escrows(status, expires_at);

-- ─── Sybil Flags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sybil_flags (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tip_id        TEXT NOT NULL REFERENCES tips(id),
  flag_score    DOUBLE PRECISION NOT NULL,
  confidence    DOUBLE PRECISION,
  weight        DOUBLE PRECISION NOT NULL,
  method        TEXT NOT NULL,
  reasons       TEXT NOT NULL,
  llm_reasoning TEXT,
  analyzed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auth Sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  family      TEXT NOT NULL,
  address     TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);

-- ─── Creator Admin Wallets ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_admin_wallets (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id      TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  family          TEXT NOT NULL,
  network         TEXT NOT NULL,
  address         TEXT NOT NULL,
  hd_path         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Payout Destinations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_destinations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id      TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  family          TEXT NOT NULL,
  network         TEXT NOT NULL,
  address         TEXT NOT NULL,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Creator Overlay Settings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_overlay_settings (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id      TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  show_tips       INTEGER NOT NULL DEFAULT 1,
  show_round      INTEGER NOT NULL DEFAULT 1,
  show_leaderboard INTEGER NOT NULL DEFAULT 1,
  theme           TEXT NOT NULL DEFAULT 'dark',
  accent_color    TEXT,
  custom_message  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Rate Snapshots ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pair        TEXT NOT NULL,
  rate        DOUBLE PRECISION NOT NULL,
  source      TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_pair_time ON rate_snapshots(pair, snapshot_at DESC);

-- ─── Round Allocations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS round_allocations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_id        TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  creator_id      TEXT NOT NULL REFERENCES creators(id),
  direct_total    TEXT NOT NULL DEFAULT '0',
  matched_amount  TEXT NOT NULL DEFAULT '0',
  score           DOUBLE PRECISION NOT NULL DEFAULT 0,
  rank            INTEGER,
  payout_address  TEXT,
  payout_family   TEXT,
  payout_network  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_round_alloc_round ON round_allocations(round_id);

-- ─── Bridge Transfers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bridge_transfers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_id        TEXT REFERENCES rounds(id),
  creator_id      TEXT REFERENCES creators(id),
  from_chain      TEXT NOT NULL,
  to_chain        TEXT NOT NULL,
  amount          TEXT NOT NULL,
  tx_hash         TEXT,
  bridge_fee      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ─── Settlement Executions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_executions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_id        TEXT NOT NULL REFERENCES rounds(id),
  creator_id      TEXT NOT NULL REFERENCES creators(id),
  amount          TEXT NOT NULL,
  payout_address  TEXT NOT NULL,
  family          TEXT NOT NULL,
  network         TEXT NOT NULL,
  tx_hash         TEXT,
  mode            TEXT NOT NULL DEFAULT 'demo',
  status          TEXT NOT NULL DEFAULT 'pending',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ─── Report Attestations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_attestations (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_id            TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  plan_hash           TEXT NOT NULL,
  plan_signature      TEXT NOT NULL,
  report_cid          TEXT,
  cid_signature       TEXT,
  agent_wallet_address TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Telegram Notifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  round_id    TEXT REFERENCES rounds(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  tx_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ
);

-- ─── Pool Snapshots ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pool_snapshots (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  round_id    TEXT REFERENCES rounds(id),
  balance     TEXT NOT NULL,
  multiplier  DOUBLE PRECISION NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Rumble Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rumble_events (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id        TEXT UNIQUE NOT NULL,
  event_type      TEXT NOT NULL,
  creator_id      TEXT NOT NULL,
  creator_handle  TEXT NOT NULL,
  video_id        TEXT,
  video_title     TEXT,
  viewer_id       TEXT,
  raw_payload     TEXT NOT NULL,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rumble_events_creator_created
  ON rumble_events(creator_id, created_at DESC);

-- ─── Rumble Creator Links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rumble_creator_links (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rumble_creator_id TEXT UNIQUE NOT NULL,
  rumble_handle     TEXT UNIQUE NOT NULL,
  creator_id        TEXT UNIQUE REFERENCES creators(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_at         TIMESTAMPTZ
);

-- ─── Auto Tip Rules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_tip_rules (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  viewer_id           TEXT NOT NULL,
  creator_id          TEXT REFERENCES creators(id),
  budget_per_day_base TEXT NOT NULL,
  tip_on_half_watch   TEXT NOT NULL DEFAULT '100000',
  tip_on_complete     TEXT NOT NULL DEFAULT '250000',
  token               TEXT NOT NULL DEFAULT 'USDT',
  chain               TEXT NOT NULL DEFAULT 'polygon',
  enabled             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, creator_id)
);

-- ─── Auto Tip Executions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_tip_executions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id       TEXT REFERENCES auto_tip_rules(id),
  viewer_id     TEXT NOT NULL,
  creator_id    TEXT NOT NULL REFERENCES creators(id),
  video_id      TEXT,
  session_id    TEXT,
  trigger_kind  TEXT NOT NULL,
  event_id      TEXT,
  amount_base   TEXT NOT NULL,
  token         TEXT NOT NULL,
  chain         TEXT NOT NULL,
  watch_percent INTEGER NOT NULL,
  tx_hash       TEXT,
  round_id      TEXT REFERENCES rounds(id),
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, creator_id, video_id, session_id, trigger_kind)
);

-- ─── Splits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS splits (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id    TEXT UNIQUE NOT NULL REFERENCES creators(id),
  creator_bps   INTEGER NOT NULL DEFAULT 8500,
  pool_bps      INTEGER NOT NULL DEFAULT 1000,
  protocol_bps  INTEGER NOT NULL DEFAULT 100,
  collaborators TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Milestone Bonuses ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestone_bonuses (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id    TEXT NOT NULL REFERENCES creators(id),
  round_id      TEXT REFERENCES rounds(id),
  milestone     TEXT NOT NULL,
  bonus_amount  TEXT NOT NULL,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audience Members (new – supports the web tipping flow) ──────────────────
-- Audience members authenticate exactly like creators via /login (seed phrase +
-- wallet family) but are NOT required to have a creator profile.  Their wallet
-- address becomes their viewer_id in auto_tip_rules / tips.
CREATE TABLE IF NOT EXISTS audience_members (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  address       TEXT NOT NULL,
  family        TEXT NOT NULL,
  network       TEXT NOT NULL,
  username      TEXT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (address, family)
);

CREATE INDEX IF NOT EXISTS idx_audience_members_address ON audience_members(address);

-- ─── Row-Level Security (optional, enable per-table in Supabase dashboard) ────
-- The backend uses the service-role key so RLS is bypassed by default.
-- Enable RLS on individual tables if you add a public/anon client path.
