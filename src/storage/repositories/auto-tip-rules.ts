import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedToken } from '../../tokens/index.js';

export interface AutoTipRuleRecord {
  id: string;
  viewer_id: string;
  creator_id?: string;
  budget_per_day_base: string;
  tip_on_half_watch: string;
  tip_on_complete: string;
  token: SupportedToken;
  chain: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class AutoTipRulesRepository {
  upsert(data: Omit<AutoTipRuleRecord, 'id' | 'created_at' | 'updated_at'>): AutoTipRuleRecord {
    const db = getDb();
    const existing = this.findByViewerAndCreator(data.viewer_id, data.creator_id);
    const now = new Date().toISOString();
    if (existing) {
      db.prepare(`
        UPDATE auto_tip_rules
        SET budget_per_day_base = ?, tip_on_half_watch = ?, tip_on_complete = ?,
            token = ?, chain = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.budget_per_day_base,
        data.tip_on_half_watch,
        data.tip_on_complete,
        data.token,
        data.chain,
        data.enabled,
        now,
        existing.id,
      );
      return this.findById(existing.id)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO auto_tip_rules (
        id, viewer_id, creator_id, budget_per_day_base,
        tip_on_half_watch, tip_on_complete, token, chain, enabled, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.viewer_id,
      data.creator_id ?? null,
      data.budget_per_day_base,
      data.tip_on_half_watch,
      data.tip_on_complete,
      data.token,
      data.chain,
      data.enabled,
      now,
    );
    return this.findById(id)!;
  }

  findById(id: string): AutoTipRuleRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM auto_tip_rules WHERE id = ?').get(id) as AutoTipRuleRecord | null;
  }

  findByViewerAndCreator(viewerId: string, creatorId?: string): AutoTipRuleRecord | null {
    const db = getDb();
    if (creatorId) {
      const specific = db.prepare(`
        SELECT * FROM auto_tip_rules
        WHERE viewer_id = ? AND creator_id = ?
      `).get(viewerId, creatorId) as AutoTipRuleRecord | null;
      if (specific) {
        return specific;
      }
    }

    return db.prepare(`
      SELECT * FROM auto_tip_rules
      WHERE viewer_id = ? AND creator_id IS NULL
    `).get(viewerId) as AutoTipRuleRecord | null;
  }

  findByViewer(viewerId: string): AutoTipRuleRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM auto_tip_rules
      WHERE viewer_id = ?
      ORDER BY creator_id IS NULL DESC, created_at DESC
    `).all(viewerId) as AutoTipRuleRecord[];
  }

  delete(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM auto_tip_rules WHERE id = ?').run(id);
  }
}
