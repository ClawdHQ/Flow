import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedToken } from '../../tokens/index.js';

export type TipSource = 'manual_bot' | 'auto_watch' | 'rumble_native' | 'rumble_super_chat' | 'milestone_bonus';

export interface TipRecord {
  id: string;
  tip_uuid: string;
  round_id: string;
  tipper_telegram_id: string;
  tipper_wallet_address?: string;
  creator_id: string;
  amount_usdt: string;
  effective_amount: string;
  chain: string;
  token?: SupportedToken;
  amount_native?: string;
  source?: TipSource;
  external_event_id?: string;
  external_actor_id?: string;
  price_rate_snapshot_id?: string;
  escrow_address?: string;
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  status: 'pending' | 'confirmed' | 'settled' | 'expired' | 'failed' | 'pending_retry';
  sybil_weight: number;
  sybil_confidence?: number;
  sybil_flagged: number;
  sybil_reasons?: string;
  sybil_reasoning?: string;
  message?: string;
  created_at: string;
  confirmed_at?: string;
  settled_at?: string;
  protocol_fee?: string;
  pool_fee?: string;
  creator_share?: string;
}

export class TipsRepository {
  create(data: Omit<TipRecord, 'id' | 'created_at'>): TipRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO tips (id, tip_uuid, round_id, tipper_telegram_id, tipper_wallet_address, creator_id,
        amount_usdt, effective_amount, chain, token, amount_native, source, external_event_id, external_actor_id, price_rate_snapshot_id,
        escrow_address, deposit_tx_hash, settlement_tx_hash,
        status, sybil_weight, sybil_confidence, sybil_flagged, sybil_reasons, sybil_reasoning, message, confirmed_at, settled_at,
        protocol_fee, pool_fee, creator_share)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.tip_uuid, data.round_id, data.tipper_telegram_id, data.tipper_wallet_address ?? null,
      data.creator_id, data.amount_usdt, data.effective_amount, data.chain,
      data.token ?? 'USDT', data.amount_native ?? data.amount_usdt, data.source ?? 'manual_bot',
      data.external_event_id ?? null, data.external_actor_id ?? null, data.price_rate_snapshot_id ?? null,
      data.escrow_address ?? null, data.deposit_tx_hash ?? null, data.settlement_tx_hash ?? null,
      data.status, data.sybil_weight, data.sybil_confidence ?? null, data.sybil_flagged, data.sybil_reasons ?? null,
      data.sybil_reasoning ?? null, data.message ?? null, data.confirmed_at ?? null, data.settled_at ?? null,
      data.protocol_fee ?? '0', data.pool_fee ?? '0', data.creator_share ?? data.amount_usdt);
    return this.findById(id)!;
  }

  findById(id: string): TipRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE id = ?').get(id) as TipRecord | null;
  }

  findByUuid(uuid: string): TipRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE tip_uuid = ?').get(uuid) as TipRecord | null;
  }

  findByExternalEventId(eventId: string): TipRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE external_event_id = ?').get(eventId) as TipRecord | null;
  }

  findByRound(roundId: string): TipRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE round_id = ?').all(roundId) as TipRecord[];
  }

  findConfirmedByRound(roundId: string): TipRecord[] {
    const db = getDb();
    return db.prepare("SELECT * FROM tips WHERE round_id = ? AND status IN ('confirmed', 'settled')").all(roundId) as TipRecord[];
  }

  findByCreatorAndRound(creatorId: string, roundId: string): TipRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE creator_id = ? AND round_id = ?').all(creatorId, roundId) as TipRecord[];
  }

  findByTipperAndRound(tipperId: string, roundId: string): TipRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM tips WHERE tipper_telegram_id = ? AND round_id = ?').all(tipperId, roundId) as TipRecord[];
  }

  findByTipper(tipperAddress: string, limit = 20): TipRecord[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM tips WHERE tipper_wallet_address = ? ORDER BY created_at DESC LIMIT ?',
    ).all(tipperAddress, limit) as TipRecord[];
  }

  update(id: string, fields: Partial<TipRecord>): void {
    const db = getDb();
    const entries = Object.entries(fields).filter(([k]) => k !== 'id');
    if (entries.length === 0) return;
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE tips SET ${setClauses} WHERE id = ?`).run(...values, id);
  }

  countByRound(roundId: string): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM tips WHERE round_id = ?').get(roundId) as { cnt: number };
    return row.cnt;
  }

  countUniqueByCreatorAndRound(creatorId: string, roundId: string): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(DISTINCT tipper_telegram_id) as cnt FROM tips WHERE creator_id = ? AND round_id = ?').get(creatorId, roundId) as { cnt: number };
    return row.cnt;
  }
}
