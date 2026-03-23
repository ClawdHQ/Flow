import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreatorOverlaySettingsRecord {
  id: string;
  creator_id: string;
  rumble_handle?: string;
  theme: string;
  position: string;
  show_tip_alerts: number;
  show_pool_bar: number;
  show_leaderboard: number;
  accent_color?: string;
  updated_at: string;
}

export class CreatorOverlaySettingsRepository {
  upsert(
    creatorId: string,
    fields: Partial<Omit<CreatorOverlaySettingsRecord, 'id' | 'creator_id' | 'updated_at'>> = {},
  ): CreatorOverlaySettingsRecord {
    const db = getDb();
    const existing = this.findByCreatorId(creatorId);
    const now = new Date().toISOString();
    if (existing) {
      const next = { ...existing, ...fields, updated_at: now };
      db.prepare(`
        UPDATE creator_overlay_settings
        SET rumble_handle = ?, theme = ?, position = ?, show_tip_alerts = ?, show_pool_bar = ?, show_leaderboard = ?, accent_color = ?, updated_at = ?
        WHERE creator_id = ?
      `).run(
        next.rumble_handle ?? null,
        next.theme,
        next.position,
        next.show_tip_alerts,
        next.show_pool_bar,
        next.show_leaderboard,
        next.accent_color ?? null,
        now,
        creatorId,
      );
      return this.findByCreatorId(creatorId)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO creator_overlay_settings (id, creator_id, rumble_handle, theme, position, show_tip_alerts, show_pool_bar, show_leaderboard, accent_color, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      creatorId,
      fields.rumble_handle ?? null,
      fields.theme ?? 'gold',
      fields.position ?? 'bottom-left',
      fields.show_tip_alerts ?? 1,
      fields.show_pool_bar ?? 1,
      fields.show_leaderboard ?? 1,
      fields.accent_color ?? null,
      now,
    );
    return this.findByCreatorId(creatorId)!;
  }

  findByCreatorId(creatorId: string): CreatorOverlaySettingsRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM creator_overlay_settings WHERE creator_id = ?').get(creatorId) as CreatorOverlaySettingsRecord | null;
  }
}
