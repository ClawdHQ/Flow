import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface RoundRecord {
  id: string;
  round_number: number;
  status: 'open' | 'locking' | 'analyzing' | 'reviewing' | 'signing' | 'executing' | 'archiving' | 'completed' | 'failed';
  started_at: string;
  ended_at?: string;
  matching_multiplier: number;
  total_direct_tips: string;
  total_matched: string;
  pool_used: string;
  ipfs_cid?: string;
  ipfs_url?: string;
  plan_hash?: string;
  agent_signature?: string;
  tipper_count: number;
  creator_count: number;
  sybil_flags_count: number;
}

export class RoundsRepository {
  create(roundNumber: number): RoundRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO rounds (id, round_number, status) VALUES (?, ?, 'open')
    `).run(id, roundNumber);
    return this.findById(id)!;
  }

  findById(id: string): RoundRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rounds WHERE id = ?').get(id) as RoundRecord | null;
  }

  findCurrent(): RoundRecord | null {
    const db = getDb();
    return db.prepare("SELECT * FROM rounds WHERE status = 'open' ORDER BY round_number DESC LIMIT 1").get() as RoundRecord | null;
  }

  findLatestCompleted(): RoundRecord | null {
    const db = getDb();
    return db.prepare("SELECT * FROM rounds WHERE status = 'completed' ORDER BY round_number DESC LIMIT 1").get() as RoundRecord | null;
  }

  updateStatus(id: string, status: RoundRecord['status']): void {
    const db = getDb();
    db.prepare('UPDATE rounds SET status = ? WHERE id = ?').run(status, id);
  }

  update(id: string, fields: Partial<RoundRecord>): void {
    const db = getDb();
    const entries = Object.entries(fields).filter(([k]) => k !== 'id');
    if (entries.length === 0) return;
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE rounds SET ${setClauses} WHERE id = ?`).run(...values, id);
  }

  findAll(limit = 50): RoundRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM rounds ORDER BY round_number DESC LIMIT ?').all(limit) as RoundRecord[];
  }

  getNextRoundNumber(): number {
    const db = getDb();
    const row = db.prepare('SELECT MAX(round_number) as max_round FROM rounds').get() as { max_round: number | null };
    return (row.max_round ?? 0) + 1;
  }
}
