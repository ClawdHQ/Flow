import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface SettlementExecutionRecord {
  id: string;
  round_id: string;
  allocation_index: number;
  creator_id: string;
  mode: string;
  status: string;
  tx_hash?: string;
  approve_hash?: string;
  reset_allowance_hash?: string;
  error?: string;
  created_at: string;
}

export class SettlementExecutionsRepository {
  create(data: Omit<SettlementExecutionRecord, 'id' | 'created_at'>): SettlementExecutionRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO settlement_executions (id, round_id, allocation_index, creator_id, mode, status, tx_hash, approve_hash, reset_allowance_hash, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.round_id,
      data.allocation_index,
      data.creator_id,
      data.mode,
      data.status,
      data.tx_hash ?? null,
      data.approve_hash ?? null,
      data.reset_allowance_hash ?? null,
      data.error ?? null,
    );
    return this.findById(id)!;
  }

  findById(id: string): SettlementExecutionRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM settlement_executions WHERE id = ?').get(id) as SettlementExecutionRecord | null;
  }

  listByRound(roundId: string): SettlementExecutionRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM settlement_executions WHERE round_id = ? ORDER BY allocation_index ASC').all(roundId) as SettlementExecutionRecord[];
  }
}
