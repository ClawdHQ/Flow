import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface SybilFlagRecord {
  id: string;
  tip_id: string;
  flag_score: number;
  confidence?: number;
  weight: number;
  method: 'rule' | 'llm';
  reasons: string;
  llm_reasoning?: string;
  analyzed_at: string;
}

export class SybilFlagsRepository {
  create(data: Omit<SybilFlagRecord, 'id' | 'analyzed_at'>): SybilFlagRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO sybil_flags (id, tip_id, flag_score, confidence, weight, method, reasons, llm_reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.tip_id, data.flag_score, data.confidence ?? null, data.weight, data.method, data.reasons, data.llm_reasoning ?? null);
    return this.findByTip(data.tip_id)!;
  }

  findByTip(tipId: string): SybilFlagRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM sybil_flags WHERE tip_id = ? ORDER BY analyzed_at DESC LIMIT 1').get(tipId) as SybilFlagRecord | null;
  }

  findFlaggedByRound(roundId: string): SybilFlagRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT sf.* FROM sybil_flags sf
      JOIN tips t ON t.id = sf.tip_id
      WHERE t.round_id = ?
    `).all(roundId) as SybilFlagRecord[];
  }

  countFlaggedByRound(roundId: string): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM sybil_flags sf
      JOIN tips t ON t.id = sf.tip_id
      WHERE t.round_id = ? AND sf.weight < 1.0
    `).get(roundId) as { cnt: number };
    return row.cnt;
  }
}
