import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface WalletRecord {
  id: string;
  address: string;
  chain: string;
  wallet_type: 'pool' | 'creator' | 'escrow';
  hd_path: string;
  encrypted_key_material: string;
  reference_id?: string;
  balance_cached?: string;
  balance_updated_at?: string;
  created_at: string;
}

export class WalletsRepository {
  create(data: Omit<WalletRecord, 'id' | 'created_at'>): WalletRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO wallets (id, address, chain, wallet_type, hd_path, encrypted_key_material, reference_id, balance_cached, balance_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.address, data.chain, data.wallet_type, data.hd_path, data.encrypted_key_material,
      data.reference_id ?? null, data.balance_cached ?? null, data.balance_updated_at ?? null);
    return this.findByAddress(data.address, data.chain)!;
  }

  findByAddress(address: string, chain: string): WalletRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM wallets WHERE address = ? AND chain = ?').get(address, chain) as WalletRecord | null;
  }

  findByReference(referenceId: string): WalletRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM wallets WHERE reference_id = ?').all(referenceId) as WalletRecord[];
  }

  findByType(walletType: string): WalletRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM wallets WHERE wallet_type = ?').all(walletType) as WalletRecord[];
  }

  update(id: string, fields: Partial<WalletRecord>): void {
    const db = getDb();
    const entries = Object.entries(fields).filter(([k]) => k !== 'id');
    if (entries.length === 0) return;
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE wallets SET ${setClauses} WHERE id = ?`).run(...values, id);
  }
}
