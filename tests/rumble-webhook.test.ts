import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHmac } from 'crypto';

describe('Rumble webhook helpers', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-rumble-webhook-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['RUMBLE_WEBHOOK_SECRET'] = 'super-secret';
    vi.resetModules();
  });

  afterEach(async () => {
    const dbModule = await import('../src/storage/db.js');
    dbModule.closeDb();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env['DB_PATH'];
    delete process.env['RUMBLE_WEBHOOK_SECRET'];
  });

  it('verifies HMAC signatures against the raw webhook body', async () => {
    const { verifySignature } = await import('../src/rumble/webhook.js');

    const payload = {
      event_id: 'evt-verify-1',
      event_type: 'video.watch_progress',
      creator_id: 'rumble:aliceonrumble',
      creator_rumble_handle: 'AliceOnRumble',
      timestamp: new Date().toISOString(),
    };
    const body = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', 'super-secret').update(body).digest('hex');

    expect(verifySignature(body, `sha256=${signature}`)).toBe(true);
    expect(verifySignature(body, 'sha256=deadbeef')).toBe(false);
  });

  it('stores and processes an accepted event without opening a real listener', async () => {
    const { processRumbleEvent } = await import('../src/rumble/webhook.js');
    const { RumbleEventsRepository } = await import('../src/storage/repositories/rumble-events.js');

    const event = {
      event_id: 'evt-1',
      event_type: 'video.watch_progress' as const,
      timestamp: new Date().toISOString(),
      creator_id: 'rumble:aliceonrumble',
      creator_rumble_handle: 'AliceOnRumble',
      video_id: 'video-1',
      viewer_id: 'viewer-1',
      session_id: 'session-1',
      watch_percent: 50,
      watch_seconds: 120,
    };

    await processRumbleEvent(event);

    const eventsRepo = new RumbleEventsRepository();
    const stored = eventsRepo.findByEventId('evt-1');
    expect(stored).not.toBeNull();
    expect(stored?.processed_at).toBeTruthy();
  });
});
