import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { RumbleEvent } from '../../rumble/events.js';

export interface RumbleEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  creator_id: string;
  creator_handle: string;
  video_id?: string;
  video_title?: string;
  viewer_id?: string;
  raw_payload: string;
  processed_at?: string;
  created_at: string;
}

export class RumbleEventsRepository {
  insert(event: RumbleEvent): RumbleEventRecord {
    const db = getDb();
    const existing = this.findByEventId(event.event_id);
    if (existing) {
      return existing;
    }
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO rumble_events (
        id, event_id, event_type, creator_id, creator_handle,
        video_id, video_title, viewer_id, raw_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.event_id,
      event.event_type,
      event.creator_id,
      event.creator_rumble_handle,
      event.video_id ?? null,
      event.video_title ?? null,
      'viewer_id' in event ? event.viewer_id ?? null : null,
      JSON.stringify(event),
    );
    return this.findById(id)!;
  }

  findById(id: string): RumbleEventRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_events WHERE id = ?').get(id) as RumbleEventRecord | null;
  }

  findByEventId(eventId: string): RumbleEventRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_events WHERE event_id = ?').get(eventId) as RumbleEventRecord | null;
  }

  markProcessed(eventId: string): void {
    const db = getDb();
    db.prepare('UPDATE rumble_events SET processed_at = ? WHERE event_id = ?')
      .run(new Date().toISOString(), eventId);
  }

  listRecent(limit = 50): RumbleEventRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rumble_events
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as RumbleEventRecord[];
  }

  listRecentByCreator(creatorId: string, limit = 10): RumbleEventRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rumble_events
      WHERE creator_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(creatorId, limit) as RumbleEventRecord[];
  }
}
