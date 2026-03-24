import { config } from './index.js';
import type { WalletFamily, WalletRole } from '../types/flow.js';

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  usdtAddress: string;
  blockTimeSeconds: number;
  isTestnet: boolean;
  wdkChainId: string;
  family: WalletFamily;
  addressPrefix?: string;
}

export type SupportedChain =
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'avalanche'
  | 'celo'
  | 'tron'
  | 'bitcoin'
  | 'ton';

export const SUPPORTED_CHAINS: SupportedChain[] = [
  'ethereum',
  'polygon',
  'arbitrum',
  'avalanche',
  'celo',
  'tron',
  'bitcoin',
  'ton',
];

export const POOL_HOME_CHAIN: SupportedChain = 'polygon';
export const MAINNET_DEFAULT_CHAIN: SupportedChain = 'polygon';
export const DEMO_DEFAULT_CHAIN: SupportedChain = 'ethereum';

const CHAIN_DISPLAY_NAMES: Record<SupportedChain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  celo: 'Celo',
  tron: 'TRON',
  bitcoin: 'Bitcoin',
  ton: 'TON',
};

const CHAIN_FAMILY: Record<SupportedChain, WalletFamily> = {
  ethereum: 'evm',
  polygon: 'evm',
  arbitrum: 'evm',
  avalanche: 'evm',
  celo: 'evm',
  tron: 'tron_gasfree',
  bitcoin: 'btc',
  ton: 'ton_gasless',
};

const HD_PATH_PREFIX: Record<SupportedChain, string> = {
  ethereum: "m/44'/60'",
  polygon: "m/44'/60'",
  arbitrum: "m/44'/60'",
  avalanche: "m/44'/60'",
  celo: "m/44'/60'",
  tron: "m/44'/195'",
  bitcoin: "m/84'/0'",
  ton: "m/44'/607'",
};

const TESTNET_HD_PATH_PREFIX: Partial<Record<SupportedChain, string>> = {
  bitcoin: "m/84'/1'",
};

const CHAIN_ALIASES: Record<string, SupportedChain> = {
  eth: 'ethereum',
  sepolia: 'ethereum',
  amoy: 'polygon',
  arb: 'arbitrum',
  'arbitrum-sepolia': 'arbitrum',
  avax: 'avalanche',
  fuji: 'avalanche',
  alfajores: 'celo',
  'celo-sepolia': 'celo',
  nile: 'tron',
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  testnet: 'bitcoin',
  ton: 'ton',
};

function getOptionalConfigString(key: string): string | undefined {
  const value = (
    process.env[key]
      ?? ((config as Record<string, unknown>)[key] as string | undefined)
  )?.trim();
  return value ? value : undefined;
}

function buildChainConfigs(testnet: boolean): Record<SupportedChain, ChainConfig> {
  if (testnet) {
    return {
      ethereum: {
        name: CHAIN_DISPLAY_NAMES.ethereum,
        chainId: 11155111,
        rpcUrl: getOptionalConfigString('ETHEREUM_SEPOLIA_RPC_URL') ?? '',
        usdtAddress: getOptionalConfigString('ETHEREUM_SEPOLIA_USDT_ADDRESS')
          ?? '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
        blockTimeSeconds: 12,
        isTestnet: true,
        wdkChainId: 'ethereum:11155111',
        family: CHAIN_FAMILY.ethereum,
      },
      polygon: {
        name: CHAIN_DISPLAY_NAMES.polygon,
        chainId: 80002,
        rpcUrl: getOptionalConfigString('POLYGON_AMOY_RPC_URL') ?? 'https://rpc-amoy.polygon.technology',
        usdtAddress: getOptionalConfigString('POLYGON_AMOY_USDT_ADDRESS')
          ?? '0x1616d5c7f9bc5cbac54e47f3fcd27caf6323dfb5',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'polygon:80002',
        family: CHAIN_FAMILY.polygon,
      },
      arbitrum: {
        name: CHAIN_DISPLAY_NAMES.arbitrum,
        chainId: 421614,
        rpcUrl: getOptionalConfigString('ARBITRUM_SEPOLIA_RPC_URL') ?? 'https://sepolia-rollup.arbitrum.io/rpc',
        usdtAddress: getOptionalConfigString('ARBITRUM_SEPOLIA_USDT_ADDRESS')
          ?? '0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63',
        blockTimeSeconds: 1,
        isTestnet: true,
        wdkChainId: 'arbitrum:421614',
        family: CHAIN_FAMILY.arbitrum,
      },
      avalanche: {
        name: CHAIN_DISPLAY_NAMES.avalanche,
        chainId: 43113,
        rpcUrl: getOptionalConfigString('AVALANCHE_FUJI_RPC_URL') ?? 'https://api.avax-test.network/ext/bc/C/rpc',
        usdtAddress: getOptionalConfigString('AVALANCHE_FUJI_USDT_ADDRESS') ?? '',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'avalanche:43113',
        family: CHAIN_FAMILY.avalanche,
      },
      celo: {
        name: CHAIN_DISPLAY_NAMES.celo,
        chainId: 11142220,
        rpcUrl: getOptionalConfigString('CELO_SEPOLIA_RPC_URL') ?? 'https://forno.celo-sepolia.celo-testnet.org',
        usdtAddress: getOptionalConfigString('CELO_SEPOLIA_USDT_ADDRESS') ?? '',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'celo:11142220',
        family: CHAIN_FAMILY.celo,
      },
      tron: {
        name: CHAIN_DISPLAY_NAMES.tron,
        chainId: 0,
        rpcUrl: getOptionalConfigString('TRON_NILE_RPC_URL') ?? 'https://nile.trongrid.io',
        usdtAddress: getOptionalConfigString('TRON_NILE_USDT_ADDRESS') ?? 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        blockTimeSeconds: 3,
        isTestnet: true,
        wdkChainId: 'tron:nile',
        family: CHAIN_FAMILY.tron,
        addressPrefix: 'T',
      },
      bitcoin: {
        name: CHAIN_DISPLAY_NAMES.bitcoin,
        chainId: 0,
        rpcUrl: getOptionalConfigString('BITCOIN_TESTNET_ELECTRUM_URL') ?? '',
        usdtAddress: '',
        blockTimeSeconds: 600,
        isTestnet: true,
        wdkChainId: 'bitcoin:testnet',
        family: CHAIN_FAMILY.bitcoin,
        addressPrefix: 'tb1',
      },
      ton: {
        name: CHAIN_DISPLAY_NAMES.ton,
        chainId: 0,
        rpcUrl: getOptionalConfigString('TON_TESTNET_RPC_URL') ?? '',
        usdtAddress: getOptionalConfigString('TON_TESTNET_USDT_ADDRESS') ?? '',
        blockTimeSeconds: 5,
        isTestnet: true,
        wdkChainId: 'ton:testnet',
        family: CHAIN_FAMILY.ton,
        addressPrefix: 'kQ',
      },
    };
  }

  return {
    ethereum: {
      name: CHAIN_DISPLAY_NAMES.ethereum,
      chainId: 1,
      rpcUrl: getOptionalConfigString('ETHEREUM_RPC_URL') ?? '',
      usdtAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      blockTimeSeconds: 12,
      isTestnet: false,
      wdkChainId: 'ethereum:1',
      family: CHAIN_FAMILY.ethereum,
    },
    polygon: {
      name: CHAIN_DISPLAY_NAMES.polygon,
      chainId: 137,
      rpcUrl: getOptionalConfigString('POLYGON_RPC_URL') ?? '',
      usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'polygon:137',
      family: CHAIN_FAMILY.polygon,
    },
    arbitrum: {
      name: CHAIN_DISPLAY_NAMES.arbitrum,
      chainId: 42161,
      rpcUrl: getOptionalConfigString('ARBITRUM_RPC_URL') ?? '',
      usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      blockTimeSeconds: 1,
      isTestnet: false,
      wdkChainId: 'arbitrum:42161',
      family: CHAIN_FAMILY.arbitrum,
    },
    avalanche: {
      name: CHAIN_DISPLAY_NAMES.avalanche,
      chainId: 43114,
      rpcUrl: getOptionalConfigString('AVALANCHE_RPC_URL') ?? 'https://api.avax.network/ext/bc/C/rpc',
      usdtAddress: '0x9702230A8EA53601f5cD2dc00fDBC13d4dF4A8c7',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'avalanche:43114',
      family: CHAIN_FAMILY.avalanche,
    },
    celo: {
      name: CHAIN_DISPLAY_NAMES.celo,
      chainId: 42220,
      rpcUrl: getOptionalConfigString('CELO_RPC_URL') ?? 'https://forno.celo.org',
      usdtAddress: '0x48065fbBE25f71C9282ddf5e1CD6D6A887483D5e',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'celo:42220',
      family: CHAIN_FAMILY.celo,
    },
    tron: {
      name: CHAIN_DISPLAY_NAMES.tron,
      chainId: 0,
      rpcUrl: getOptionalConfigString('TRON_RPC_URL') ?? '',
      usdtAddress: getOptionalConfigString('TRON_USDT_ADDRESS') ?? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      blockTimeSeconds: 3,
      isTestnet: false,
      wdkChainId: 'tron:mainnet',
      family: CHAIN_FAMILY.tron,
      addressPrefix: 'T',
    },
    bitcoin: {
      name: CHAIN_DISPLAY_NAMES.bitcoin,
      chainId: 0,
      rpcUrl: getOptionalConfigString('BITCOIN_ELECTRUM_URL') ?? '',
      usdtAddress: '',
      blockTimeSeconds: 600,
      isTestnet: false,
      wdkChainId: 'bitcoin:mainnet',
      family: CHAIN_FAMILY.bitcoin,
      addressPrefix: 'bc1',
    },
    ton: {
      name: CHAIN_DISPLAY_NAMES.ton,
      chainId: 0,
      rpcUrl: getOptionalConfigString('TON_RPC_URL') ?? '',
      usdtAddress: getOptionalConfigString('TON_USDT_ADDRESS') ?? '',
      blockTimeSeconds: 5,
      isTestnet: false,
      wdkChainId: 'ton:mainnet',
      family: CHAIN_FAMILY.ton,
      addressPrefix: 'EQ',
    },
  };
}

export function isTestnetEnabled(): boolean {
  return process.env['USE_TESTNET'] === 'true' || (config as Record<string, unknown>)['USE_TESTNET'] === true;
}

export function getDefaultChain(testnet = isTestnetEnabled()): SupportedChain {
  const configured = normalizeChain(
    (process.env['DEFAULT_CHAIN'] ?? (config as Record<string, unknown>)['DEFAULT_CHAIN'] as string | undefined) ?? null
  );
  if (configured) {
    return configured;
  }
  return testnet ? DEMO_DEFAULT_CHAIN : MAINNET_DEFAULT_CHAIN;
}

export function getPoolHomeChain(): SupportedChain {
  return POOL_HOME_CHAIN;
}

export function getChainConfig(chain: SupportedChain): ChainConfig {
  return buildChainConfigs(isTestnetEnabled())[chain];
}

export function getChain(name: SupportedChain, testnet?: boolean): ChainConfig {
  const useTestnet = testnet !== undefined ? testnet : isTestnetEnabled();
  return buildChainConfigs(useTestnet)[name];
}

export function isSupportedChain(value: string): value is SupportedChain {
  return SUPPORTED_CHAINS.includes(value as SupportedChain);
}

export function normalizeChain(value?: string | null): SupportedChain | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const alias = CHAIN_ALIASES[normalized];
  if (alias) return alias;
  return isSupportedChain(normalized) ? normalized : null;
}

export function getHdPathPrefix(chain: SupportedChain): string {
  if (isTestnetEnabled() && TESTNET_HD_PATH_PREFIX[chain]) {
    return TESTNET_HD_PATH_PREFIX[chain]!;
  }
  return HD_PATH_PREFIX[chain];
}

export function getChainDisplayName(chain?: string | null): string {
  const normalizedChain = normalizeChain(chain);
  return CHAIN_DISPLAY_NAMES[normalizedChain ?? getDefaultChain()];
}

export function getWalletFamilyForChain(chain: SupportedChain, role: WalletRole = 'creator'): WalletFamily {
  if (role === 'pool') {
    return 'evm_erc4337';
  }
  if (chain === 'ton') {
    return role === 'creator' ? 'ton_gasless' : 'ton';
  }
  return CHAIN_FAMILY[chain];
}

export function isEvmChain(chain: SupportedChain): boolean {
  return CHAIN_FAMILY[chain] === 'evm';
}

export function isBridgeEligibleChain(chain: SupportedChain): boolean {
  return isEvmChain(chain);
}

export function isIndexerBackedChain(chain: SupportedChain): boolean {
  return ['ethereum', 'polygon', 'arbitrum', 'avalanche', 'celo', 'tron'].includes(chain);
}
