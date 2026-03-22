import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedToken } from '../../tokens/index.js';

export interface MilestoneBonusRecord {
  id: string;
  creator_id: string;
  event_id: string;
  milestone_value: number;
  bonus_amount: string;
  token: SupportedToken;
  tx_hash?: string;
  paid_at: string;
}

export class MilestoneBonusesRepository {
  create(data: Omit<MilestoneBonusRecord, 'id' | 'paid_at'>): MilestoneBonusRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO milestone_bonuses (id, creator_id, event_id, milestone_value, bonus_amount, token, tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.creator_id,
      data.event_id,
      data.milestone_value,
      data.bonus_amount,
      data.token,
      data.tx_hash ?? null,
    );
    return this.findById(id)!;
  }

  findById(id: string): MilestoneBonusRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM milestone_bonuses WHERE id = ?').get(id) as MilestoneBonusRecord | null;
  }

  listRecent(limit = 20): MilestoneBonusRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM milestone_bonuses
      ORDER BY paid_at DESC
      LIMIT ?
    `).all(limit) as MilestoneBonusRecord[];
  }

  findByEventId(eventId: string): MilestoneBonusRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM milestone_bonuses WHERE event_id = ?').get(eventId) as MilestoneBonusRecord | null;
  }
}
