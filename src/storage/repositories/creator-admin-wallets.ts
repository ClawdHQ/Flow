import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { CreatorAdminWallet } from '../../types/flow.js';

export interface CreatorAdminWalletRecord extends CreatorAdminWallet {
  id: string;
  created_at: string;
}

export class CreatorAdminWalletsRepository {
  upsert(data: Omit<CreatorAdminWalletRecord, 'id' | 'created_at'>): CreatorAdminWalletRecord {
    const db = getDb();
    const existing = this.findByCreatorId(data.creatorId);
    if (existing) {
      db.prepare(`
        UPDATE creator_admin_wallets
        SET family = ?, network = ?, address = ?, auth_method = ?, public_key = ?
        WHERE creator_id = ?
      `).run(data.family, data.network, data.address, data.auth_method, data.public_key ?? null, data.creatorId);
      return this.findByCreatorId(data.creatorId)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO creator_admin_wallets (id, creator_id, family, network, address, auth_method, public_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.creatorId, data.family, data.network, data.address, data.auth_method, data.public_key ?? null);
    return this.findByCreatorId(data.creatorId)!;
  }

  findByCreatorId(creatorId: string): CreatorAdminWalletRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM creator_admin_wallets WHERE creator_id = ?').get(creatorId) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      id: String(row.id),
      creatorId: String(row.creator_id),
      family: row.family as CreatorAdminWalletRecord['family'],
      network: String(row.network),
      address: String(row.address),
      auth_method: row.auth_method as CreatorAdminWalletRecord['auth_method'],
      public_key: row.public_key ? String(row.public_key) : undefined,
      created_at: String(row.created_at),
    };
  }

  findByAddress(address: string): CreatorAdminWalletRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM creator_admin_wallets WHERE lower(address) = lower(?) ORDER BY created_at DESC LIMIT 1').get(address) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      id: String(row.id),
      creatorId: String(row.creator_id),
      family: row.family as CreatorAdminWalletRecord['family'],
      network: String(row.network),
      address: String(row.address),
      auth_method: row.auth_method as CreatorAdminWalletRecord['auth_method'],
      public_key: row.public_key ? String(row.public_key) : undefined,
      created_at: String(row.created_at),
    };
  }
}
