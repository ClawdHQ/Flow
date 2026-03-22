import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('AutoTipAgent', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-auto-tip-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['AUTO_TIP_ENABLED'] = 'true';
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

  it('fires one auto-tip per milestone and respects duplicate suppression', async () => {
    const { CreatorsRepository } = await import('../src/storage/repositories/creators.js');
    const { RoundsRepository } = await import('../src/storage/repositories/rounds.js');
    const { RumbleCreatorLinksRepository } = await import('../src/storage/repositories/rumble-creator-links.js');
    const { TipsRepository } = await import('../src/storage/repositories/tips.js');
    const { AutoTipExecutionsRepository } = await import('../src/storage/repositories/auto-tip-executions.js');
    const { AutoTipAgent } = await import('../src/agent/auto-tip.js');

    const creatorsRepo = new CreatorsRepository();
    const roundsRepo = new RoundsRepository();
    const linksRepo = new RumbleCreatorLinksRepository();
    const tipsRepo = new TipsRepository();
    const executionsRepo = new AutoTipExecutionsRepository();

    const creator = creatorsRepo.create({
      telegram_id: '100',
      username: 'alice',
      payout_address: '0x1234567890123456789012345678901234567890',
      preferred_chain: 'ethereum',
    });
    roundsRepo.create(1);
    linksRepo.linkCreator('rumble:aliceonrumble', 'AliceOnRumble', creator.id);

    const transferToken = vi.fn().mockResolvedValue('0xauto');
    const analyzeTip = vi.fn().mockResolvedValue({ weight: 1, flagged: false, reasons: [], method: 'rule' });
    const agent = new AutoTipAgent({
      creatorWallet: {
        getOrCreateWallet: vi.fn().mockResolvedValue({
          address: '0xAccumulationWallet',
          hdPath: "m/44'/60'/1'/0/0",
          chain: 'ethereum',
        }),
      } as never,
      sybilDetector: {
        analyzeTip,
      } as never,
      poolWalletFactory: () => ({ transferToken }),
    });

    const event = {
      event_id: 'evt-auto-1',
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

    await agent.handleWatchEvent(event);
    await agent.handleWatchEvent(event);

    expect(transferToken).toHaveBeenCalledTimes(1);
    expect(analyzeTip).toHaveBeenCalledTimes(1);
    expect(tipsRepo.findByExternalEventId('evt-auto-1')).not.toBeNull();
    expect(executionsRepo.getViewerStats('viewer-1').tipCount).toBe(1);
  });
});
