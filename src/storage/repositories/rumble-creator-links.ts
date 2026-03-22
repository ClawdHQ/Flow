import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface RumbleCreatorLinkRecord {
  id: string;
  rumble_creator_id: string;
  rumble_handle: string;
  creator_id?: string;
  created_at: string;
  linked_at?: string;
}

export class RumbleCreatorLinksRepository {
  upsertIdentity(rumbleCreatorId: string, rumbleHandle: string): RumbleCreatorLinkRecord {
    const db = getDb();
    const existing = this.findByRumbleCreatorId(rumbleCreatorId) ?? this.findByHandle(rumbleHandle);
    if (existing) {
      db.prepare(`
        UPDATE rumble_creator_links
        SET rumble_creator_id = ?, rumble_handle = ?
        WHERE id = ?
      `).run(rumbleCreatorId, rumbleHandle, existing.id);
      return this.findById(existing.id)!;
    }

    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO rumble_creator_links (id, rumble_creator_id, rumble_handle)
      VALUES (?, ?, ?)
    `).run(id, rumbleCreatorId, rumbleHandle);
    return this.findById(id)!;
  }

  linkCreator(rumbleCreatorId: string, rumbleHandle: string, creatorId: string): RumbleCreatorLinkRecord {
    const identity = this.upsertIdentity(rumbleCreatorId, rumbleHandle);
    const db = getDb();
    db.prepare(`
      UPDATE rumble_creator_links
      SET creator_id = ?, linked_at = ?
      WHERE id = ?
    `).run(creatorId, new Date().toISOString(), identity.id);
    return this.findById(identity.id)!;
  }

  findById(id: string): RumbleCreatorLinkRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_creator_links WHERE id = ?').get(id) as RumbleCreatorLinkRecord | null;
  }

  findByCreatorId(creatorId: string): RumbleCreatorLinkRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_creator_links WHERE creator_id = ?').get(creatorId) as RumbleCreatorLinkRecord | null;
  }

  findByRumbleCreatorId(rumbleCreatorId: string): RumbleCreatorLinkRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_creator_links WHERE rumble_creator_id = ?').get(rumbleCreatorId) as RumbleCreatorLinkRecord | null;
  }

  findByHandle(handle: string): RumbleCreatorLinkRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM rumble_creator_links WHERE lower(rumble_handle) = lower(?)').get(handle) as RumbleCreatorLinkRecord | null;
  }
}
