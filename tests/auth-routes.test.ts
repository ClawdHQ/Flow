import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

describe('Auth routes', () => {
  let dbPath = '';
  let server: Server | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `flow-auth-routes-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['FLOW_PUBLIC_BASE_URL'] = 'http://localhost:3000';
    vi.resetModules();

    const { createDashboardApp } = await import('../src/dashboard/server.js');
    const app = createDashboardApp();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close(err => (err ? reject(err) : resolve()));
      });
      server = null;
    }

    const dbModule = await import('../src/storage/db.js');
    dbModule.closeDb();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env['DB_PATH'];
  });

  it('POST /api/auth/seed returns a generated seed phrase', async () => {
    const response = await fetch(`${baseUrl}/api/auth/seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.seedPhrase).toBe('string');
    expect(body.seedPhrase.trim().split(/\s+/).length).toBeGreaterThanOrEqual(12);
  });

  it('POST /api/auth/connect creates a session for a valid request', async () => {
    const response = await fetch(`${baseUrl}/api/auth/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        family: 'evm',
        network: 'polygon',
        username: 'route_user',
        seedPhrase: 'test test test test test test test test test test test junk',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionToken).toBeTruthy();
    expect(body.username).toBe('route_user');
    expect(body.address).toMatch(/^0x/i);
  });

  it('POST /api/auth/connect returns 400 when seed phrase is missing', async () => {
    const response = await fetch(`${baseUrl}/api/auth/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        family: 'evm',
        network: 'polygon',
        username: 'route_user',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/seedphrase|seed phrase/i);
  });
});
