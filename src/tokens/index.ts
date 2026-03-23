import { config } from '../config/index.js';
import { getChainConfig, isTestnetEnabled, type SupportedChain } from '../config/chains.js';

export type SupportedToken = 'USDT' | 'XAUT' | 'USAT' | 'BTC';
export type TokenChainKey =
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'avalanche'
  | 'celo'
  | 'tron'
  | 'bitcoin'
  | 'ton'
  | 'ethereum_sepolia'
  | 'polygon_amoy'
  | 'arbitrum_sepolia'
  | 'avalanche_fuji'
  | 'celo_sepolia'
  | 'tron_nile'
  | 'bitcoin_testnet'
  | 'ton_testnet';

export interface TokenConfig {
  symbol: SupportedToken;
  name: string;
  decimals: number;
  contractAddress: Partial<Record<TokenChainKey, string>>;
  isNative: boolean;
}

export const TOKENS: Record<SupportedToken, TokenConfig> = {
  USDT: {
    symbol: 'USDT',
    name: 'USD₮',
    decimals: 6,
    contractAddress: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      ethereum_sepolia: '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
      polygon_amoy: '0x1616d5C7f9bc5CBAC54E47f3Fcd27CAf6323dFb5',
      arbitrum_sepolia: '0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63',
    },
    isNative: false,
  },
  XAUT: {
    symbol: 'XAUT',
    name: 'XAU₮ (Tether Gold)',
    decimals: 6,
    contractAddress: {
      ethereum: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
      polygon: '0x9c9e5fD8bbc25984B178FdEE0f9eAbc06B6c746',
      avalanche: '0xAb9c4b5dc29C2b6A657A4dd2a0B5433b9b5B1e22',
    },
    isNative: false,
  },
  USAT: {
    symbol: 'USAT',
    name: 'USA₮',
    decimals: 6,
    contractAddress: {
      ethereum: '0x0000000000000000000000000000000000000000',
    },
    isNative: false,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    contractAddress: {},
    isNative: true,
  },
};

export const TOKEN_WEIGHT_MULTIPLIERS: Record<SupportedToken, number> = {
  USDT: 1,
  XAUT: 2,
  USAT: 1,
  BTC: 3,
};

function pow10(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

export function getTokenAddress(token: SupportedToken, chain: TokenChainKey): string | undefined {
  return TOKENS[token].contractAddress[chain];
}

export function formatAmount(amount: bigint, token: SupportedToken): string {
  const decimals = TOKENS[token].decimals;
  const divisor = pow10(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  return `${whole}.${frac.toString().padStart(decimals, '0')}`;
}

export function parseAmount(amount: string, token: SupportedToken): bigint {
  const decimals = TOKENS[token].decimals;
  const [whole = '0', frac = ''] = amount.split('.');
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * pow10(decimals) + BigInt(fracPadded || '0');
}

export function getTokenWeightMultiplier(token: SupportedToken): number {
  return TOKEN_WEIGHT_MULTIPLIERS[token];
}

export function resolveActiveTokenChainKey(chain: SupportedChain, testnet = isTestnetEnabled()): TokenChainKey {
  if (!testnet) {
    return (chain === 'bitcoin' || chain === 'ton') ? chain : chain;
  }

  const mapping: Record<SupportedChain, TokenChainKey> = {
    ethereum: 'ethereum_sepolia',
    polygon: 'polygon_amoy',
    arbitrum: 'arbitrum_sepolia',
    avalanche: 'avalanche_fuji',
    celo: 'celo_sepolia',
    tron: 'tron_nile',
    bitcoin: 'bitcoin_testnet',
    ton: 'ton_testnet',
  };
  return mapping[chain];
}

export function getActiveTokenAddress(token: SupportedToken, chain: SupportedChain, testnet = isTestnetEnabled()): string | undefined {
  if (token === 'USDT') {
    const configured = getChainConfig(chain).usdtAddress?.trim();
    return configured || undefined;
  }
  const chainKey = resolveActiveTokenChainKey(chain, testnet);
  return getTokenAddress(token, chainKey);
}

export function isTokenEnabled(token: SupportedToken): boolean {
  switch (token) {
    case 'XAUT':
      return config.XAUT_ENABLED;
    case 'BTC':
      return config.BTC_ENABLED;
    case 'USAT':
      return config.USAT_ENABLED;
    case 'USDT':
    default:
      return true;
  }
}
