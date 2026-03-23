import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuthSessionRecord {
  id: string;
  creator_id: string;
  family: string;
  address: string;
  token: string;
  expires_at: string;
  revoked_at?: string;
  created_at: string;
}

export class AuthSessionsRepository {
  create(data: Omit<AuthSessionRecord, 'id' | 'created_at' | 'revoked_at'>): AuthSessionRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO auth_sessions (id, creator_id, family, address, token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.creator_id, data.family, data.address, data.token, data.expires_at);
    return this.findByToken(data.token)!;
  }

  findByToken(token: string): AuthSessionRecord | null {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM auth_sessions
      WHERE token = ? AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(token) as AuthSessionRecord | null;
  }

  revoke(token: string): void {
    const db = getDb();
    db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE token = ?').run(new Date().toISOString(), token);
  }
}
