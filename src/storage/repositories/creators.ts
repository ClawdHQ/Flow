import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreatorRecord {
  id: string;
  telegram_id: string;
  username: string;
  payout_address: string;
  preferred_chain: string;
  accumulation_wallet_address?: string;
  accumulation_wallet_path?: string;
  total_received: string;
  total_matched: string;
  round_count: number;
  registered_at: string;
}

export class CreatorsRepository {
  create(data: Omit<CreatorRecord, 'id' | 'registered_at' | 'total_received' | 'total_matched' | 'round_count'>): CreatorRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO creators (id, telegram_id, username, payout_address, preferred_chain, accumulation_wallet_address, accumulation_wallet_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.telegram_id, data.username, data.payout_address, data.preferred_chain,
      data.accumulation_wallet_address ?? null, data.accumulation_wallet_path ?? null);
    return this.findById(id)!;
  }

  findById(id: string): CreatorRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM creators WHERE id = ?').get(id) as CreatorRecord | null;
  }

  findByTelegramId(telegramId: string): CreatorRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM creators WHERE telegram_id = ?').get(telegramId) as CreatorRecord | null;
  }

  findByUsername(username: string): CreatorRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM creators WHERE username = ?').get(username) as CreatorRecord | null;
  }

  update(id: string, fields: Partial<CreatorRecord>): void {
    const db = getDb();
    const entries = Object.entries(fields).filter(([k]) => k !== 'id');
    if (entries.length === 0) return;
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE creators SET ${setClauses} WHERE id = ?`).run(...values, id);
  }

  findAll(): CreatorRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM creators').all() as CreatorRecord[];
  }

  getIndexById(id: string): number {
    const db = getDb();
    const creators = db.prepare('SELECT id FROM creators ORDER BY registered_at ASC, id ASC').all() as Array<{ id: string }>;
    const index = creators.findIndex(creator => creator.id === id);
    if (index === -1) {
      throw new Error(`Creator not found: ${id}`);
    }
    return index;
  }

  count(): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM creators').get() as { cnt: number };
    return row.cnt;
  }
}
