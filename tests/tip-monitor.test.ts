import { describe, expect, it, vi } from 'vitest';

const {
  analyzeTipMock,
  confirmDepositMock,
  findPendingMock,
  tipFindByIdMock,
  tipUpdateMock,
} = vi.hoisted(() => ({
  analyzeTipMock: vi.fn(),
  confirmDepositMock: vi.fn(),
  findPendingMock: vi.fn(),
  tipFindByIdMock: vi.fn(),
  tipUpdateMock: vi.fn(),
}));

vi.mock('../src/wallet/escrow.js', () => ({
  EscrowWalletManager: class {
    findPending(...args: unknown[]) {
      return findPendingMock(...args);
    }

    confirmDeposit(...args: unknown[]) {
      return confirmDepositMock(...args);
    }
  }
}));

vi.mock('../src/storage/repositories/tips.js', () => ({
  TipsRepository: class {
    findById(...args: unknown[]) {
      return tipFindByIdMock(...args);
    }

    update(...args: unknown[]) {
      return tipUpdateMock(...args);
    }
  }
}));

vi.mock('../src/agent/sybil.js', () => ({
  SybilDetector: class {
    analyzeTip(...args: unknown[]) {
      return analyzeTipMock(...args);
    }
  }
}));

describe('resumePendingTipConfirmations', () => {
  it('resumes pending escrow checks and notifies the saved chat', async () => {
    vi.resetModules();

    findPendingMock.mockReturnValue([{
      tipId: 'tip-1',
      address: '0xEscrow',
      chain: 'ethereum',
      hdPath: "m/44'/60'/2'/0/0",
      derivationIndex: 0,
      expectedAmount: 10_000_000n,
      status: 'pending',
      chatId: '-100123',
      createdAt: '2026-03-22T00:00:00.000Z',
      expiresAt: '2026-03-22T00:05:00.000Z',
    }]);
    confirmDepositMock.mockResolvedValue(true);
    tipFindByIdMock.mockReturnValue({
      id: 'tip-1',
      tip_uuid: 'tip-uuid-1',
      round_id: 'round-1',
      tipper_telegram_id: '42',
      creator_id: 'creator-1',
      amount_usdt: '10000000',
      effective_amount: '10000000',
      chain: 'ethereum',
      escrow_address: '0xEscrow',
      status: 'pending',
      sybil_weight: 1,
      sybil_flagged: 0,
      created_at: '2026-03-22T00:00:00.000Z',
    });
    analyzeTipMock.mockResolvedValue({
      weight: 1,
      flagged: false,
      reasons: [],
    });

    const { resumePendingTipConfirmations } = await import('../src/bot/tip-monitor.js');
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await resumePendingTipConfirmations({
      api: { sendMessage },
    } as never);
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalled();
    });

    expect(confirmDepositMock).toHaveBeenCalledWith('tip-1');
    expect(tipUpdateMock).toHaveBeenCalledWith('tip-1', expect.objectContaining({
      status: 'confirmed',
    }));
    expect(sendMessage).toHaveBeenCalledWith('-100123', expect.stringContaining('Deposit confirmed'));
  });
});
