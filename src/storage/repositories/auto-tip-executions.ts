import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedToken } from '../../tokens/index.js';

export interface AutoTipExecutionRecord {
  id: string;
  rule_id?: string;
  viewer_id: string;
  creator_id: string;
  video_id?: string;
  session_id?: string;
  trigger_kind: 'half_watch' | 'complete';
  event_id?: string;
  amount_base: string;
  token: SupportedToken;
  chain: string;
  watch_percent: number;
  tx_hash?: string;
  round_id?: string;
  executed_at: string;
}

export class AutoTipExecutionsRepository {
  create(data: Omit<AutoTipExecutionRecord, 'id' | 'executed_at'>): AutoTipExecutionRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO auto_tip_executions (
        id, rule_id, viewer_id, creator_id, video_id, session_id, trigger_kind, event_id,
        amount_base, token, chain, watch_percent, tx_hash, round_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.rule_id ?? null,
      data.viewer_id,
      data.creator_id,
      data.video_id ?? null,
      data.session_id ?? null,
      data.trigger_kind,
      data.event_id ?? null,
      data.amount_base,
      data.token,
      data.chain,
      data.watch_percent,
      data.tx_hash ?? null,
      data.round_id ?? null,
    );
    return this.findById(id)!;
  }

  findById(id: string): AutoTipExecutionRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM auto_tip_executions WHERE id = ?').get(id) as AutoTipExecutionRecord | null;
  }

  wasExecuted(viewerId: string, creatorId: string, videoId: string | undefined, sessionId: string | undefined, triggerKind: AutoTipExecutionRecord['trigger_kind']): boolean {
    const db = getDb();
    const row = db.prepare(`
      SELECT 1 AS found
      FROM auto_tip_executions
      WHERE viewer_id = ? AND creator_id = ? AND IFNULL(video_id, '') = IFNULL(?, '')
        AND IFNULL(session_id, '') = IFNULL(?, '') AND trigger_kind = ?
      LIMIT 1
    `).get(viewerId, creatorId, videoId ?? null, sessionId ?? null, triggerKind) as { found: number } | null;
    return Boolean(row?.found);
  }

  getDailySpend(viewerId: string): bigint {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(CAST(amount_base AS INTEGER)), 0) AS total
      FROM auto_tip_executions
      WHERE viewer_id = ? AND executed_at >= datetime('now', 'start of day')
    `).get(viewerId) as { total: number | string };
    return BigInt(row.total ?? 0);
  }

  getViewerStats(viewerId: string): { spend: bigint; tipCount: number; creatorCount: number } {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(amount_base AS INTEGER)), 0) AS spend,
        COUNT(*) AS tip_count,
        COUNT(DISTINCT creator_id) AS creator_count
      FROM auto_tip_executions
      WHERE viewer_id = ? AND executed_at >= datetime('now', 'start of day')
    `).get(viewerId) as { spend: number | string; tip_count: number; creator_count: number };
    return {
      spend: BigInt(row.spend ?? 0),
      tipCount: row.tip_count,
      creatorCount: row.creator_count,
    };
  }

  getSummary(): {
    todayTipCount: number;
    todayTotalBase: bigint;
    allTimeTipCount: number;
    allTimeTotalBase: bigint;
  } {
    const db = getDb();
    const today = db.prepare(`
      SELECT COUNT(*) AS tip_count, COALESCE(SUM(CAST(amount_base AS INTEGER)), 0) AS total_base
      FROM auto_tip_executions
      WHERE executed_at >= datetime('now', 'start of day')
    `).get() as { tip_count: number; total_base: number | string };
    const allTime = db.prepare(`
      SELECT COUNT(*) AS tip_count, COALESCE(SUM(CAST(amount_base AS INTEGER)), 0) AS total_base
      FROM auto_tip_executions
    `).get() as { tip_count: number; total_base: number | string };
    return {
      todayTipCount: today.tip_count,
      todayTotalBase: BigInt(today.total_base ?? 0),
      allTimeTipCount: allTime.tip_count,
      allTimeTotalBase: BigInt(allTime.total_base ?? 0),
    };
  }

  listRecentStats(days = 7): Array<{
    creator_id: string;
    tip_count: number;
    total_base: string;
    token: SupportedToken;
    date: string;
  }> {
    const db = getDb();
    return db.prepare(`
      SELECT creator_id, COUNT(*) AS tip_count,
             COALESCE(SUM(CAST(amount_base AS INTEGER)), 0) AS total_base,
             token, DATE(executed_at) AS date
      FROM auto_tip_executions
      WHERE executed_at > datetime('now', ?)
      GROUP BY creator_id, token, DATE(executed_at)
      ORDER BY date DESC, tip_count DESC
    `).all(`-${days} days`) as Array<{
      creator_id: string;
      tip_count: number;
      total_base: string;
      token: SupportedToken;
      date: string;
    }>;
  }
}
