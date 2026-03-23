import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface BridgeTransferRecord {
  id: string;
  round_id?: string;
  creator_id?: string;
  source_network: string;
  destination_network: string;
  token: string;
  amount: string;
  status: string;
  approve_hash?: string;
  tx_hash?: string;
  reset_allowance_hash?: string;
  created_at: string;
  updated_at: string;
}

export class BridgeTransfersRepository {
  create(data: Omit<BridgeTransferRecord, 'id' | 'created_at' | 'updated_at'>): BridgeTransferRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO bridge_transfers (id, round_id, creator_id, source_network, destination_network, token, amount, status, approve_hash, tx_hash, reset_allowance_hash, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.round_id ?? null,
      data.creator_id ?? null,
      data.source_network,
      data.destination_network,
      data.token,
      data.amount,
      data.status,
      data.approve_hash ?? null,
      data.tx_hash ?? null,
      data.reset_allowance_hash ?? null,
      now,
    );
    return this.findById(id)!;
  }

  update(id: string, fields: Partial<BridgeTransferRecord>): void {
    const db = getDb();
    const entries = Object.entries({ ...fields, updated_at: new Date().toISOString() }).filter(([key]) => key !== 'id');
    if (entries.length === 0) return;
    const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
    db.prepare(`UPDATE bridge_transfers SET ${setClause} WHERE id = ?`).run(...entries.map(([, value]) => value), id);
  }

  findById(id: string): BridgeTransferRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM bridge_transfers WHERE id = ?').get(id) as BridgeTransferRecord | null;
  }

  listByRound(roundId: string): BridgeTransferRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM bridge_transfers WHERE round_id = ? ORDER BY created_at ASC').all(roundId) as BridgeTransferRecord[];
  }
}
