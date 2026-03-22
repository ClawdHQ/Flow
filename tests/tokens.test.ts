import { beforeEach, describe, expect, it } from 'vitest';

describe('token registry', () => {
  beforeEach(() => {
    process.env['USE_TESTNET'] = 'true';
  });

  it('formats and parses supported token amounts', async () => {
    const { formatAmount, parseAmount } = await import('../src/tokens/index.js');
    expect(formatAmount(1_500_000n, 'USDT')).toBe('1.500000');
    expect(parseAmount('1.5', 'USDT')).toBe(1_500_000n);
    expect(formatAmount(123_456_789n, 'BTC')).toBe('1.23456789');
  });

  it('resolves active token addresses for testnet-aware tokens', async () => {
    const { getActiveTokenAddress } = await import('../src/tokens/index.js');
    expect(getActiveTokenAddress('USDT', 'ethereum')).toBeTruthy();
    expect(getActiveTokenAddress('XAUT', 'ethereum')).toBeUndefined();
  });
});
