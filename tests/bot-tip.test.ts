import { describe, expect, it, vi } from 'vitest';

const {
  createForTipMock,
  confirmDepositMock,
  tipUpdateMock,
  tipFindByIdMock,
} = vi.hoisted(() => ({
  createForTipMock: vi.fn(),
  confirmDepositMock: vi.fn(),
  tipUpdateMock: vi.fn(),
  tipFindByIdMock: vi.fn(),
}));

vi.mock('../src/storage/repositories/creators.js', () => ({
  CreatorsRepository: class {
    findByUsername(username: string) {
      return {
        id: 'creator-1',
        username,
        preferred_chain: 'ethereum',
      };
    }
  }
}));

vi.mock('../src/storage/repositories/tips.js', () => ({
  TipsRepository: class {
    create(data: Record<string, unknown>) {
      return {
        id: 'tip-record-id',
        ...data,
      };
    }

    update(...args: unknown[]) {
      return tipUpdateMock(...args);
    }

    findById(...args: unknown[]) {
      return tipFindByIdMock(...args);
    }
  }
}));

vi.mock('../src/storage/repositories/rounds.js', () => ({
  RoundsRepository: class {
    findCurrent() {
      return { id: 'round-1' };
    }
  }
}));

vi.mock('../src/wallet/escrow.js', () => ({
  EscrowWalletManager: class {
    createForTip(...args: unknown[]) {
      return createForTipMock(...args);
    }

    confirmDeposit(...args: unknown[]) {
      return confirmDepositMock(...args);
    }
  }
}));

vi.mock('../src/agent/sybil.js', () => ({
  SybilDetector: class {
    analyzeTip() {
      return Promise.resolve({
        weight: 1,
        flagged: false,
        reasons: [],
      });
    }
  }
}));

describe('handleTip', () => {
  it('uses the persisted tip id for escrow creation and confirmation', async () => {
    vi.resetModules();
    createForTipMock.mockResolvedValue({
      tipId: 'tip-record-id',
      address: '0xEscrow',
      chain: 'ethereum',
      expectedAmount: 10_000_000n,
      status: 'pending',
    });
    confirmDepositMock.mockResolvedValue(false);
    tipFindByIdMock.mockReturnValue(null);

    const { handleTip } = await import('../src/bot/commands/tip.js');
    const reply = vi.fn().mockResolvedValue(undefined);

    await handleTip({
      message: { text: '/tip @femikiwi 10 hello friend' },
      from: { id: 12345 },
      reply,
    } as never);

    await Promise.resolve();

    expect(createForTipMock).toHaveBeenCalledWith('tip-record-id', 10_000_000n, 'ethereum', {
      chatId: '12345',
    });
    expect(confirmDepositMock).toHaveBeenCalledWith('tip-record-id');
    expect(tipUpdateMock).toHaveBeenCalledWith('tip-record-id', {
      escrow_address: '0xEscrow',
      chain: 'ethereum',
    });
  });
});
