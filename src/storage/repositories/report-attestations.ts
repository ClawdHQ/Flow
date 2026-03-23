import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface ReportAttestationRecord {
  id: string;
  round_id: string;
  plan_hash: string;
  plan_signature: string;
  report_cid?: string;
  cid_signature?: string;
  agent_wallet_address?: string;
  created_at: string;
}

export class ReportAttestationsRepository {
  create(data: Omit<ReportAttestationRecord, 'id' | 'created_at'>): ReportAttestationRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO report_attestations (id, round_id, plan_hash, plan_signature, report_cid, cid_signature, agent_wallet_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.round_id, data.plan_hash, data.plan_signature, data.report_cid ?? null, data.cid_signature ?? null, data.agent_wallet_address ?? null);
    return this.findLatestByRound(data.round_id)!;
  }

  findLatestByRound(roundId: string): ReportAttestationRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM report_attestations WHERE round_id = ? ORDER BY created_at DESC LIMIT 1').get(roundId) as ReportAttestationRecord | null;
  }
}
