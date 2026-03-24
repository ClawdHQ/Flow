import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('AuthService', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-auth-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['FLOW_PUBLIC_BASE_URL'] = 'http://localhost:3000';
    vi.resetModules();
  });

  afterEach(async () => {
    const dbModule = await import('../src/storage/db.js');
    dbModule.closeDb();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env['DB_PATH'];
  });

  it('connects with a seed phrase and creates a session', async () => {
    const { authService } = await import('../src/auth/service.js');

    const session = await authService.connectManagedWallet({
      family: 'evm',
      network: 'polygon',
      username: 'alice_evm',
      seedPhrase: 'test test test test test test test test test test test junk',
    });

    expect(session.sessionToken).toBeTruthy();
    expect(session.username).toBe('alice_evm');
    expect(session.address).toMatch(/^0x/i);
  });

  it('fails first login without username', async () => {
    const { authService } = await import('../src/auth/service.js');

    await expect(authService.connectManagedWallet({
      family: 'evm',
      network: 'polygon',
      seedPhrase: 'test test test test test test test test test test test junk',
    })).rejects.toThrow(/username is required/i);
  });

  it('rejects malformed seed phrases', async () => {
    const { authService } = await import('../src/auth/service.js');

    await expect(authService.connectManagedWallet({
      family: 'evm',
      network: 'polygon',
      username: 'bad_seed_user',
      seedPhrase: 'too short seed',
    })).rejects.toThrow(/seed phrase/i);
  });
});
