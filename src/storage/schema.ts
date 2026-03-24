import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some(entry => entry.name === column);
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  if (hasColumn(db, table, column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

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
      settled_at TEXT,
      protocol_fee TEXT NOT NULL DEFAULT '0',
      pool_fee TEXT NOT NULL DEFAULT '0',
      creator_share TEXT NOT NULL DEFAULT '0'
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
      confidence REAL,
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

    CREATE TABLE IF NOT EXISTS rumble_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      creator_handle TEXT NOT NULL,
      video_id TEXT,
      video_title TEXT,
      viewer_id TEXT,
      raw_payload TEXT NOT NULL,
      processed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rumble_events_creator_created
      ON rumble_events(creator_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS rumble_creator_links (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      rumble_creator_id TEXT UNIQUE NOT NULL,
      rumble_handle TEXT UNIQUE NOT NULL,
      creator_id TEXT UNIQUE REFERENCES creators(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      linked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auto_tip_rules (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      viewer_id TEXT NOT NULL,
      creator_id TEXT REFERENCES creators(id),
      budget_per_day_base TEXT NOT NULL,
      tip_on_half_watch TEXT NOT NULL DEFAULT '100000',
      tip_on_complete TEXT NOT NULL DEFAULT '250000',
      token TEXT NOT NULL DEFAULT 'USDT',
      chain TEXT NOT NULL DEFAULT 'polygon',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(viewer_id, creator_id)
    );

    CREATE TABLE IF NOT EXISTS auto_tip_executions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      rule_id TEXT REFERENCES auto_tip_rules(id),
      viewer_id TEXT NOT NULL,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      video_id TEXT,
      session_id TEXT,
      trigger_kind TEXT NOT NULL,
      event_id TEXT,
      amount_base TEXT NOT NULL,
      token TEXT NOT NULL,
      chain TEXT NOT NULL,
      watch_percent INTEGER NOT NULL,
      tx_hash TEXT,
      round_id TEXT REFERENCES rounds(id),
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_tip_exec_dedupe
      ON auto_tip_executions(viewer_id, creator_id, IFNULL(video_id, ''), IFNULL(session_id, ''), trigger_kind);

    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id),
      creator_bps INTEGER NOT NULL DEFAULT 8500,
      pool_bps INTEGER NOT NULL DEFAULT 1000,
      protocol_bps INTEGER NOT NULL DEFAULT 100,
      collaborators TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestone_bonuses (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id),
      event_id TEXT NOT NULL REFERENCES rumble_events(event_id),
      milestone_value INTEGER NOT NULL,
      bonus_amount TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT 'USDT',
      tx_hash TEXT,
      paid_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      address TEXT NOT NULL,
      family TEXT NOT NULL,
      network TEXT NOT NULL,
      role TEXT NOT NULL,
      derivation_path TEXT,
      capability_json TEXT NOT NULL DEFAULT '{}',
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(address, family, network, role)
    );

    CREATE TABLE IF NOT EXISTS creator_admin_wallets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      family TEXT NOT NULL,
      network TEXT NOT NULL,
      address TEXT NOT NULL,
      auth_method TEXT NOT NULL,
      public_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(creator_id, family, network, address)
    );

    CREATE TABLE IF NOT EXISTS payout_destinations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      family TEXT NOT NULL,
      network TEXT NOT NULL,
      token TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(creator_id)
    );

    CREATE TABLE IF NOT EXISTS creator_overlay_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      rumble_handle TEXT,
      theme TEXT NOT NULL DEFAULT 'gold',
      position TEXT NOT NULL DEFAULT 'bottom-left',
      show_tip_alerts INTEGER NOT NULL DEFAULT 1,
      show_pool_bar INTEGER NOT NULL DEFAULT 1,
      show_leaderboard INTEGER NOT NULL DEFAULT 1,
      accent_color TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(creator_id)
    );

    CREATE TABLE IF NOT EXISTS rate_snapshots (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      token TEXT NOT NULL,
      quote_token TEXT NOT NULL DEFAULT 'USDT',
      rate TEXT NOT NULL,
      source TEXT NOT NULL,
      captured_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS round_allocations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      payout_address TEXT NOT NULL,
      payout_family TEXT NOT NULL,
      payout_network TEXT NOT NULL,
      payout_token TEXT NOT NULL,
      direct_tips TEXT NOT NULL,
      match_amount TEXT NOT NULL,
      score TEXT NOT NULL,
      unique_tippers INTEGER NOT NULL DEFAULT 0,
      settlement_mode TEXT NOT NULL,
      tx_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bridge_transfers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_id TEXT REFERENCES rounds(id) ON DELETE CASCADE,
      creator_id TEXT REFERENCES creators(id),
      source_network TEXT NOT NULL,
      destination_network TEXT NOT NULL,
      token TEXT NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      approve_hash TEXT,
      tx_hash TEXT,
      reset_allowance_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settlement_executions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      allocation_index INTEGER NOT NULL,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      approve_hash TEXT,
      reset_allowance_hash TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_attestations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      plan_hash TEXT NOT NULL,
      plan_signature TEXT NOT NULL,
      report_cid TEXT,
      cid_signature TEXT,
      agent_wallet_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telegram_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      round_id TEXT REFERENCES rounds(id) ON DELETE CASCADE,
      telegram_id TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      tx_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      family TEXT NOT NULL,
      address TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wdk_operation_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      operation_type TEXT NOT NULL,
      family TEXT NOT NULL,
      network TEXT NOT NULL,
      reference_id TEXT,
      request_json TEXT,
      response_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumn(db, 'tips', 'token', "TEXT NOT NULL DEFAULT 'USDT'");
  ensureColumn(db, 'tips', 'amount_native', 'TEXT');
  ensureColumn(db, 'tips', 'source', "TEXT NOT NULL DEFAULT 'manual_bot'");
  ensureColumn(db, 'tips', 'external_event_id', 'TEXT');
  ensureColumn(db, 'tips', 'external_actor_id', 'TEXT');
  ensureColumn(db, 'tips', 'price_rate_snapshot_id', 'TEXT');
  ensureColumn(db, 'tips', 'sybil_confidence', 'REAL');
  ensureColumn(db, 'tips', 'sybil_reasoning', 'TEXT');
  ensureColumn(db, 'rounds', 'plan_json', 'TEXT');
  ensureColumn(db, 'rounds', 'plan_signature', 'TEXT');
  ensureColumn(db, 'rounds', 'cid_signature', 'TEXT');
  ensureColumn(db, 'rounds', 'pool_wallet_address', 'TEXT');
  ensureColumn(db, 'sybil_flags', 'confidence', 'REAL');
  ensureColumn(db, 'creators', 'profile_bio', 'TEXT');
  ensureColumn(db, 'creators', 'status_badges_json', 'TEXT');
  ensureColumn(db, 'tips', 'protocol_fee', "TEXT NOT NULL DEFAULT '0'");
  ensureColumn(db, 'tips', 'pool_fee', "TEXT NOT NULL DEFAULT '0'");
  ensureColumn(db, 'tips', 'creator_share', "TEXT NOT NULL DEFAULT '0'");

  // Legacy cleanup after challenge/verify auth flow removal
  db.exec('DROP TABLE IF EXISTS auth_challenges');
}
