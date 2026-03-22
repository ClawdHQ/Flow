import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('EventTriggerAgent', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-event-trigger-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['BTC_USDT_RATE'] = '100000';
    vi.resetModules();
  });

  afterEach(async () => {
    const dbModule = await import('../src/storage/db.js');
    dbModule.closeDb();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env['DB_PATH'];
    delete process.env['BTC_USDT_RATE'];
  });

  it('mirrors a rumble-native tip into the FLOW ledger with premium weighting', async () => {
    const { CreatorsRepository } = await import('../src/storage/repositories/creators.js');
    const { RoundsRepository } = await import('../src/storage/repositories/rounds.js');
    const { RumbleCreatorLinksRepository } = await import('../src/storage/repositories/rumble-creator-links.js');
    const { TipsRepository } = await import('../src/storage/repositories/tips.js');
    const { EventTriggerAgent } = await import('../src/agent/event-trigger.js');

    const creatorsRepo = new CreatorsRepository();
    const roundsRepo = new RoundsRepository();
    const linksRepo = new RumbleCreatorLinksRepository();
    const tipsRepo = new TipsRepository();

    const creator = creatorsRepo.create({
      telegram_id: '200',
      username: 'bob',
      payout_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      preferred_chain: 'ethereum',
    });
    roundsRepo.create(1);
    linksRepo.linkCreator('rumble:bobonrumble', 'BobOnRumble', creator.id);

    const analyzeTip = vi.fn().mockResolvedValue({ weight: 1, flagged: false, reasons: [], method: 'rule' });
    const agent = new EventTriggerAgent({
      sybilDetector: {
        analyzeTip,
      } as never,
    });

    await agent.handleRumbleTip({
      event_id: 'evt-rumble-tip-1',
      event_type: 'tip.completed',
      timestamp: new Date().toISOString(),
      creator_id: 'rumble:bobonrumble',
      creator_rumble_handle: 'BobOnRumble',
      viewer_id: 'viewer-btc',
      amount_base_units: '100000000',
      token: 'BTC',
      tx_hash: '0xbtc',
      chain: 'ethereum',
    });

    const tip = tipsRepo.findByExternalEventId('evt-rumble-tip-1');
    expect(tip).not.toBeNull();
    expect(tip?.source).toBe('rumble_native');
    expect(tip?.token).toBe('BTC');
    expect(BigInt(tip?.effective_amount ?? '0')).toBeGreaterThan(BigInt(tip?.amount_usdt ?? '0'));
    expect(analyzeTip).toHaveBeenCalledTimes(1);
  });
});
