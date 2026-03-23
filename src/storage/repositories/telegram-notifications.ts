import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface TelegramNotificationRecord {
  id: string;
  creator_id: string;
  round_id?: string;
  telegram_id: string;
  message: string;
  status: string;
  tx_hash?: string;
  created_at: string;
  sent_at?: string;
}

export class TelegramNotificationsRepository {
  create(data: Omit<TelegramNotificationRecord, 'id' | 'created_at'>): TelegramNotificationRecord {
    const db = getDb();
    const id = uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO telegram_notifications (id, creator_id, round_id, telegram_id, message, status, tx_hash, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.creator_id,
      data.round_id ?? null,
      data.telegram_id,
      data.message,
      data.status,
      data.tx_hash ?? null,
      data.sent_at ?? null,
    );
    return this.findById(id)!;
  }

  findById(id: string): TelegramNotificationRecord | null {
    const db = getDb();
    return db.prepare('SELECT * FROM telegram_notifications WHERE id = ?').get(id) as TelegramNotificationRecord | null;
  }
}
