import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('EscrowWalletManager persistence', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-escrow-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
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

  async function createTipFixtures() {
    const { CreatorsRepository } = await import('../src/storage/repositories/creators.js');
    const { RoundsRepository } = await import('../src/storage/repositories/rounds.js');
    const { TipsRepository } = await import('../src/storage/repositories/tips.js');

    const creatorsRepo = new CreatorsRepository();
    const roundsRepo = new RoundsRepository();
    const tipsRepo = new TipsRepository();

    const creator = creatorsRepo.create({
      telegram_id: 'creator-telegram',
      username: 'alice',
      payout_address: '0x1234567890123456789012345678901234567890',
      preferred_chain: 'ethereum',
    });

    const round = roundsRepo.create(1);
    const tipOne = tipsRepo.create({
      tip_uuid: 'tip-one',
      round_id: round.id,
      tipper_telegram_id: 'tipper-one',
      creator_id: creator.id,
      amount_usdt: '1000000',
      effective_amount: '1000000',
      chain: 'ethereum',
      status: 'pending',
      sybil_weight: 1,
      sybil_flagged: 0,
    });
    const tipTwo = tipsRepo.create({
      tip_uuid: 'tip-two',
      round_id: round.id,
      tipper_telegram_id: 'tipper-two',
      creator_id: creator.id,
      amount_usdt: '2000000',
      effective_amount: '2000000',
      chain: 'ethereum',
      status: 'pending',
      sybil_weight: 1,
      sybil_flagged: 0,
    });

    return { tipOne, tipTwo };
  }

  it('keeps escrow derivation indexes stable across restarts', async () => {
    const { tipOne, tipTwo } = await createTipFixtures();
    const { closeDb } = await import('../src/storage/db.js');
    const { EscrowWalletManager } = await import('../src/wallet/escrow.js');

    const createEscrowWallet = vi.fn(async (index: number, chain: string) => ({
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
      hdPath: `m/44'/60'/2'/0/${index}`,
      chain,
    }));
    const wallet = {
      createEscrowWallet,
      getBalance: vi.fn().mockResolvedValue(0n),
      sendUSDT: vi.fn(),
    };

    const managerA = new EscrowWalletManager({
      wallet,
      clock: () => 1_000,
      sleep: async () => undefined,
      confirmationTimeoutMs: 1_000,
      pollIntervalMs: 10,
    });

    const firstEscrow = await managerA.createForTip(tipOne.id, 1_000_000n, 'ethereum');
    expect(firstEscrow.derivationIndex).toBe(0);
    expect(firstEscrow.hdPath).toBe("m/44'/60'/2'/0/0");

    closeDb();

    const managerB = new EscrowWalletManager({
      wallet,
      clock: () => 2_000,
      sleep: async () => undefined,
      confirmationTimeoutMs: 1_000,
      pollIntervalMs: 10,
    });

    expect(managerB.findByTipId(tipOne.id)).toMatchObject({
      derivationIndex: 0,
      hdPath: "m/44'/60'/2'/0/0",
    });

    const secondEscrow = await managerB.createForTip(tipTwo.id, 2_000_000n, 'ethereum');
    expect(secondEscrow.derivationIndex).toBe(1);
    expect(secondEscrow.hdPath).toBe("m/44'/60'/2'/0/1");
    expect(createEscrowWallet).toHaveBeenNthCalledWith(1, 0, 'ethereum');
    expect(createEscrowWallet).toHaveBeenNthCalledWith(2, 1, 'ethereum');
  });

  it('confirms persisted escrows after a restart', async () => {
    const { tipOne } = await createTipFixtures();
    const { closeDb } = await import('../src/storage/db.js');
    const { EscrowWalletManager } = await import('../src/wallet/escrow.js');

    const managerA = new EscrowWalletManager({
      wallet: {
        createEscrowWallet: vi.fn(async (index: number, chain: string) => ({
          address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
          hdPath: `m/44'/60'/2'/0/${index}`,
          chain,
        })),
        getBalance: vi.fn().mockResolvedValue(0n),
        sendUSDT: vi.fn(),
      },
      clock: () => 1_000,
      sleep: async () => undefined,
      confirmationTimeoutMs: 5_000,
      pollIntervalMs: 10,
    });

    await managerA.createForTip(tipOne.id, 1_000_000n, 'ethereum');
    closeDb();

    const managerB = new EscrowWalletManager({
      wallet: {
        createEscrowWallet: vi.fn(),
        getBalance: vi.fn().mockResolvedValue(1_000_000n),
        sendUSDT: vi.fn(),
      },
      clock: () => 2_000,
      sleep: async () => undefined,
      confirmationTimeoutMs: 5_000,
      pollIntervalMs: 10,
    });

    await expect(managerB.confirmDeposit(tipOne.id)).resolves.toBe(true);
    expect(managerB.findByTipId(tipOne.id)).toMatchObject({
      status: 'confirmed',
    });
  });
});
