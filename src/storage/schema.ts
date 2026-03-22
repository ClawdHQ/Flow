import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_number INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      matching_multiplier REAL NOT NULL DEFAULT 1.0,
      total_direct_tips TEXT NOT NULL DEFAULT '0',
      total_matched TEXT NOT NULL DEFAULT '0',
      pool_used TEXT NOT NULL DEFAULT '0',
      ipfs_cid TEXT,
      ipfs_url TEXT,
      plan_hash TEXT,
      agent_signature TEXT,
      tipper_count INTEGER NOT NULL DEFAULT 0,
      creator_count INTEGER NOT NULL DEFAULT 0,
      sybil_flags_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS creators (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      payout_address TEXT NOT NULL,
      preferred_chain TEXT NOT NULL DEFAULT 'polygon',
      accumulation_wallet_address TEXT,
      accumulation_wallet_path TEXT,
      total_received TEXT NOT NULL DEFAULT '0',
      total_matched TEXT NOT NULL DEFAULT '0',
      round_count INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tip_uuid TEXT UNIQUE NOT NULL,
      round_id TEXT NOT NULL REFERENCES rounds(id),
      tipper_telegram_id TEXT NOT NULL,
      tipper_wallet_address TEXT,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      amount_usdt TEXT NOT NULL,
      effective_amount TEXT NOT NULL,
      chain TEXT NOT NULL DEFAULT 'polygon',
      escrow_address TEXT,
      deposit_tx_hash TEXT,
      settlement_tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sybil_weight REAL NOT NULL DEFAULT 1.0,
      sybil_flagged INTEGER NOT NULL DEFAULT 0,
      sybil_reasons TEXT,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      wallet_type TEXT NOT NULL,
      hd_path TEXT NOT NULL,
      encrypted_key_material TEXT NOT NULL,
      reference_id TEXT,
      balance_cached TEXT,
      balance_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(address, chain)
    );

    CREATE TABLE IF NOT EXISTS escrows (
      tip_id TEXT PRIMARY KEY REFERENCES tips(id) ON DELETE CASCADE,
      derivation_index INTEGER NOT NULL UNIQUE,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      hd_path TEXT NOT NULL,
      expected_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      chat_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      confirmed_at TEXT,
      settled_at TEXT,
      refunded_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_escrows_status_expires_at
      ON escrows(status, expires_at);

    CREATE TABLE IF NOT EXISTS sybil_flags (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tip_id TEXT NOT NULL REFERENCES tips(id),
      flag_score REAL NOT NULL,
      weight REAL NOT NULL,
      method TEXT NOT NULL,
      reasons TEXT NOT NULL,
      llm_reasoning TEXT,
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pool_snapshots (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_id TEXT REFERENCES rounds(id),
      balance TEXT NOT NULL,
      multiplier REAL NOT NULL,
      snapshot_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
