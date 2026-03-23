import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { PayoutDestination } from '../../types/flow.js';

export interface PayoutDestinationRecord extends PayoutDestination {
  id: string;
  created_at: string;
  updated_at: string;
}

export class PayoutDestinationsRepository {
  upsert(data: Omit<PayoutDestinationRecord, 'id' | 'created_at' | 'updated_at'>): PayoutDestinationRecord {
    const db = getDb();
    const existing = this.findByCreatorId(data.creatorId);
    const now = new Date().toISOString();
    if (existing) {
      db.prepare(`
        UPDATE payout_destinations
        SET family = ?, network = ?, token = ?, address = ?, updated_at = ?
        WHERE creator_id = ?
      `).run(data.family, data.network, data.token, data.address, now, data.creatorId);
      return this.findByCreatorId(data.creatorId)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO payout_destinations (id, creator_id, family, network, token, address, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.creatorId, data.family, data.network, data.token, data.address, now);
    return this.findByCreatorId(data.creatorId)!;
  }

  findByCreatorId(creatorId: string): PayoutDestinationRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM payout_destinations WHERE creator_id = ?').get(creatorId) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      id: String(row.id),
      creatorId: String(row.creator_id),
      family: row.family as PayoutDestinationRecord['family'],
      network: String(row.network),
      token: String(row.token),
      address: String(row.address),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }
}
