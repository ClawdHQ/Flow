import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuthChallengeRecord {
  id: string;
  family: string;
  address: string;
  network: string;
  challenge: string;
  nonce: string;
  host: string;
  payload_json?: string;
  expires_at: string;
  consumed_at?: string;
  created_at: string;
}

export class AuthChallengesRepository {
  create(data: Omit<AuthChallengeRecord, 'id' | 'created_at' | 'consumed_at'>): AuthChallengeRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO auth_challenges (id, family, address, network, challenge, nonce, host, payload_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.family, data.address, data.network, data.challenge, data.nonce, data.host, data.payload_json ?? null, data.expires_at);
    return this.findById(id)!;
  }

  findActive(family: string, address: string): AuthChallengeRecord | null {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM auth_challenges
      WHERE family = ? AND address = ? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(family, address) as AuthChallengeRecord | null;
  }

  findById(id: string): AuthChallengeRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(id) as AuthChallengeRecord | null;
  }

  consume(id: string): void {
    const db = getDb();
    db.prepare('UPDATE auth_challenges SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }
}
