import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { RateSnapshot } from '../../types/flow.js';

export interface RateSnapshotRecord extends RateSnapshot {
  id: string;
}

export class RateSnapshotsRepository {
  create(data: Omit<RateSnapshotRecord, 'id'>): RateSnapshotRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO rate_snapshots (id, token, quote_token, rate, source, captured_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.token, data.quoteToken, data.rate, data.source, data.capturedAt);
    return this.findById(id)!;
  }

  findById(id: string): RateSnapshotRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM rate_snapshots WHERE id = ?').get(id) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      id: String(row.id),
      token: String(row.token),
      quoteToken: row.quote_token as 'USDT',
      rate: String(row.rate),
      source: row.source as RateSnapshotRecord['source'],
      capturedAt: String(row.captured_at),
    };
  }

  findLatestByToken(token: string): RateSnapshotRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM rate_snapshots WHERE token = ? ORDER BY captured_at DESC LIMIT 1').get(token) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      id: String(row.id),
      token: String(row.token),
      quoteToken: row.quote_token as 'USDT',
      rate: String(row.rate),
      source: row.source as RateSnapshotRecord['source'],
      capturedAt: String(row.captured_at),
    };
  }
}
