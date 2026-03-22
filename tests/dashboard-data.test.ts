import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('dashboard data snapshots', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-dashboard-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
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

  it('computes round, leaderboard, sybil, and history snapshots from source records', async () => {
    const { CreatorsRepository } = await import('../src/storage/repositories/creators.js');
    const { RoundsRepository } = await import('../src/storage/repositories/rounds.js');
    const { TipsRepository } = await import('../src/storage/repositories/tips.js');
    const { SybilFlagsRepository } = await import('../src/storage/repositories/sybil-flags.js');
    const {
      getCurrentRoundSnapshot,
      getCurrentRoundSybilFlags,
      getRecentRoundSnapshots,
      getRoundLeaderboardSnapshot,
    } = await import('../src/dashboard/data.js');

    const creatorsRepo = new CreatorsRepository();
    const roundsRepo = new RoundsRepository();
    const tipsRepo = new TipsRepository();
    const flagsRepo = new SybilFlagsRepository();

    const alice = creatorsRepo.create({
      telegram_id: '100',
      username: 'alice',
      payout_address: '0x1234567890123456789012345678901234567890',
      preferred_chain: 'polygon',
    });
    const bob = creatorsRepo.create({
      telegram_id: '200',
      username: 'bob',
      payout_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      preferred_chain: 'polygon',
    });

    const currentRound = roundsRepo.create(1);
    const completedRound = roundsRepo.create(2);
    roundsRepo.updateStatus(completedRound.id, 'completed');
    roundsRepo.update(completedRound.id, { total_matched: '3000000' });

    const aliceTip = tipsRepo.create({
      tip_uuid: 'tip-1',
      round_id: currentRound.id,
      tipper_telegram_id: 'tipper-1',
      creator_id: alice.id,
      amount_usdt: '1000000',
      effective_amount: '1000000',
      chain: 'polygon',
      status: 'confirmed',
      sybil_weight: 1.0,
      sybil_flagged: 0,
    });
    tipsRepo.create({
      tip_uuid: 'tip-2',
      round_id: currentRound.id,
      tipper_telegram_id: 'tipper-2',
      creator_id: bob.id,
      amount_usdt: '4000000',
      effective_amount: '2500000',
      chain: 'polygon',
      status: 'settled',
      sybil_weight: 0.5,
      sybil_flagged: 1,
    });
    tipsRepo.create({
      tip_uuid: 'tip-3',
      round_id: currentRound.id,
      tipper_telegram_id: 'tipper-3',
      creator_id: bob.id,
      amount_usdt: '9000000',
      effective_amount: '9000000',
      chain: 'polygon',
      status: 'pending',
      sybil_weight: 1.0,
      sybil_flagged: 0,
    });
    tipsRepo.create({
      tip_uuid: 'tip-4',
      round_id: completedRound.id,
      tipper_telegram_id: 'tipper-4',
      creator_id: alice.id,
      amount_usdt: '5000000',
      effective_amount: '5000000',
      chain: 'polygon',
      status: 'settled',
      sybil_weight: 1.0,
      sybil_flagged: 0,
    });

    flagsRepo.create({
      tip_id: aliceTip.id,
      flag_score: 0.91,
      weight: 0.1,
      method: 'rule',
      reasons: JSON.stringify(['Suspicious velocity']),
    });

    const round = getCurrentRoundSnapshot();
    expect(round).not.toBeNull();
    expect(round).toMatchObject({
      round_number: 1,
      total_direct_tips: '5.000000',
      total_direct_tips_base_units: '5000000',
      tipper_count: 2,
      creator_count: 2,
      sybil_flags_count: 1,
    });

    const leaderboard = getRoundLeaderboardSnapshot(currentRound);
    expect(leaderboard.map(entry => entry.creator)).toEqual(['bob', 'alice']);
    expect(leaderboard[0]).toMatchObject({
      total: '2.500000',
      total_base_units: '2500000',
    });

    const flags = getCurrentRoundSybilFlags();
    expect(flags).toHaveLength(1);
    expect(flags[0]?.method).toBe('rule');

    const rounds = getRecentRoundSnapshots(5);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject({
      round_number: 2,
      total_direct_tips: '5.000000',
      total_matched: '3.000000',
    });
  });
});
