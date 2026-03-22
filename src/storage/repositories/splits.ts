import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface SplitCollaborator {
  address: string;
  chain: string;
  bps: number;
}

export interface SplitRecord {
  id: string;
  creator_id: string;
  creator_bps: number;
  pool_bps: number;
  protocol_bps: number;
  collaborators?: string;
  created_at: string;
  updated_at: string;
}

export class SplitsRepository {
  upsert(data: Omit<SplitRecord, 'id' | 'created_at' | 'updated_at'>): SplitRecord {
    const db = getDb();
    const existing = this.findByCreatorId(data.creator_id);
    const now = new Date().toISOString();
    if (existing) {
      db.prepare(`
        UPDATE splits
        SET creator_bps = ?, pool_bps = ?, protocol_bps = ?, collaborators = ?, updated_at = ?
        WHERE creator_id = ?
      `).run(
        data.creator_bps,
        data.pool_bps,
        data.protocol_bps,
        data.collaborators ?? null,
        now,
        data.creator_id,
      );
      return this.findByCreatorId(data.creator_id)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO splits (id, creator_id, creator_bps, pool_bps, protocol_bps, collaborators, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.creator_id,
      data.creator_bps,
      data.pool_bps,
      data.protocol_bps,
      data.collaborators ?? null,
      now,
    );
    return this.findByCreatorId(data.creator_id)!;
  }

  findByCreatorId(creatorId: string): SplitRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM splits WHERE creator_id = ?').get(creatorId) as SplitRecord | null;
  }
}
