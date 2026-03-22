import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chain defaults and labels', () => {
  async function loadChainsModule() {
    vi.resetModules();
    return import('../src/config/chains.js');
  }

  beforeEach(() => {
    process.env['DEFAULT_CHAIN'] = '';
    process.env['USE_TESTNET'] = '';
    process.env['ETHEREUM_SEPOLIA_USDT_ADDRESS'] = '';
  });

  it('defaults to ethereum in demo mode and polygon in non-testnet mode', async () => {
    process.env['USE_TESTNET'] = 'true';
    let chains = await loadChainsModule();
    expect(chains.getDefaultChain()).toBe('ethereum');

    process.env['USE_TESTNET'] = 'false';
    chains = await loadChainsModule();
    expect(chains.getDefaultChain()).toBe('polygon');
  });

  it('allows overriding the default chain from env aliases', async () => {
    process.env['USE_TESTNET'] = 'true';
    process.env['DEFAULT_CHAIN'] = 'sepolia';
    let chains = await loadChainsModule();
    expect(chains.getDefaultChain()).toBe('ethereum');

    process.env['DEFAULT_CHAIN'] = 'tron';
    chains = await loadChainsModule();
    expect(chains.getDefaultChain()).toBe('tron');
  });

  it('uses Pimlico USD₮ on Sepolia by default and keeps bot labels generic', async () => {
    process.env['USE_TESTNET'] = 'true';
    delete process.env['ETHEREUM_SEPOLIA_USDT_ADDRESS'];
    const chains = await loadChainsModule();
    expect(chains.getChainConfig('ethereum').usdtAddress).toBe('0xd077A400968890Eacc75cdc901F0356c943e4fDb');
    expect(chains.getChainDisplayName('ethereum')).toBe('Ethereum');
  });
});
