import { getDb } from '../db.js';

export type EscrowStatus = 'pending' | 'confirmed' | 'settled' | 'refunded' | 'expired';

export interface EscrowDbRecord {
  tip_id: string;
  derivation_index: number;
  address: string;
  chain: string;
  hd_path: string;
  expected_amount: string;
  status: EscrowStatus;
  chat_id?: string;
  created_at: string;
  expires_at: string;
  confirmed_at?: string;
  settled_at?: string;
  refunded_at?: string;
}

export class EscrowsRepository {
  create(data: Omit<EscrowDbRecord, 'created_at'>): EscrowDbRecord {
    const db = getDb();
    db.prepare(`
      INSERT INTO escrows (
        tip_id, derivation_index, address, chain, hd_path, expected_amount,
        status, chat_id, expires_at, confirmed_at, settled_at, refunded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.tip_id,
      data.derivation_index,
      data.address,
      data.chain,
      data.hd_path,
      data.expected_amount,
      data.status,
      data.chat_id ?? null,
      data.expires_at,
      data.confirmed_at ?? null,
      data.settled_at ?? null,
      data.refunded_at ?? null,
    );
    return this.findByTipId(data.tip_id)!;
  }

  findByTipId(tipId: string): EscrowDbRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM escrows WHERE tip_id = ?').get(tipId) as EscrowDbRecord | null;
  }

  findPending(): EscrowDbRecord[] {
    const db = getDb();
    return db.prepare("SELECT * FROM escrows WHERE status = 'pending' ORDER BY created_at ASC").all() as EscrowDbRecord[];
  }

  update(tipId: string, fields: Partial<EscrowDbRecord>): void {
    const db = getDb();
    const entries = Object.entries(fields).filter(([key]) => key !== 'tip_id');
    if (entries.length === 0) return;
    const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    db.prepare(`UPDATE escrows SET ${setClauses} WHERE tip_id = ?`).run(...values, tipId);
  }

  getNextDerivationIndex(): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(derivation_index), -1) + 1 AS next_index
      FROM escrows
    `).get() as { next_index: number };
    return row.next_index;
  }
}
