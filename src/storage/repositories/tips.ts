import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

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
  escrow_address?: string;
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  status: 'pending' | 'confirmed' | 'settled' | 'expired' | 'failed' | 'pending_retry';
  sybil_weight: number;
  sybil_flagged: number;
  sybil_reasons?: string;
  message?: string;
  created_at: string;
  confirmed_at?: string;
  settled_at?: string;
}

export class TipsRepository {
  create(data: Omit<TipRecord, 'id' | 'created_at'>): TipRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO tips (id, tip_uuid, round_id, tipper_telegram_id, tipper_wallet_address, creator_id,
        amount_usdt, effective_amount, chain, escrow_address, deposit_tx_hash, settlement_tx_hash,
        status, sybil_weight, sybil_flagged, sybil_reasons, message, confirmed_at, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.tip_uuid, data.round_id, data.tipper_telegram_id, data.tipper_wallet_address ?? null,
      data.creator_id, data.amount_usdt, data.effective_amount, data.chain,
      data.escrow_address ?? null, data.deposit_tx_hash ?? null, data.settlement_tx_hash ?? null,
      data.status, data.sybil_weight, data.sybil_flagged, data.sybil_reasons ?? null,
      data.message ?? null, data.confirmed_at ?? null, data.settled_at ?? null);
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
