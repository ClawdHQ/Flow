import { config } from './index.js';

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  usdtAddress: string;
  blockTimeSeconds: number;
  isTestnet: boolean;
  wdkChainId: string;
}

export type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'avalanche' | 'celo' | 'tron';
export const SUPPORTED_CHAINS: SupportedChain[] = ['ethereum', 'polygon', 'arbitrum', 'avalanche', 'celo', 'tron'];
export const MAINNET_DEFAULT_CHAIN: SupportedChain = 'polygon';
export const DEMO_DEFAULT_CHAIN: SupportedChain = 'ethereum';

const CHAIN_DISPLAY_NAMES: Record<SupportedChain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  celo: 'Celo',
  tron: 'Tron',
};

const HD_PATH_PREFIX: Record<SupportedChain, string> = {
  ethereum: "m/44'/60'",
  polygon: "m/44'/60'",
  arbitrum: "m/44'/60'",
  avalanche: "m/44'/60'",
  celo: "m/44'/60'",
  tron: "m/44'/195'",
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
      },
      polygon: {
        name: CHAIN_DISPLAY_NAMES.polygon,
        chainId: 80002,
        rpcUrl: getOptionalConfigString('POLYGON_AMOY_RPC_URL') ?? 'https://rpc-amoy.polygon.technology',
        // NOTE: Verify with Tether's official testnet deployments before production use
        usdtAddress: '0x1E3f675Cd66Ef9C0fb04Ace98C6Cf60E6Cf22fC',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'polygon:80002',
      },
      arbitrum: {
        name: CHAIN_DISPLAY_NAMES.arbitrum,
        chainId: 421614,
        rpcUrl: getOptionalConfigString('ARBITRUM_SEPOLIA_RPC_URL') ?? 'https://sepolia-rollup.arbitrum.io/rpc',
        // NOTE: Verify with Tether's official testnet deployments before production use
        usdtAddress: '0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63',
        blockTimeSeconds: 1,
        isTestnet: true,
        wdkChainId: 'arbitrum:421614',
      },
      avalanche: {
        name: CHAIN_DISPLAY_NAMES.avalanche,
        chainId: 43113,
        rpcUrl: getOptionalConfigString('AVALANCHE_FUJI_RPC_URL') ?? 'https://api.avax-test.network/ext/bc/C/rpc',
        // NOTE: Set AVALANCHE_FUJI_USDT_ADDRESS when using testnet mode on Avalanche.
        usdtAddress: getOptionalConfigString('AVALANCHE_FUJI_USDT_ADDRESS') ?? '',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'avalanche:43113',
      },
      celo: {
        name: CHAIN_DISPLAY_NAMES.celo,
        chainId: 11142220,
        rpcUrl: getOptionalConfigString('CELO_SEPOLIA_RPC_URL') ?? 'https://forno.celo-sepolia.celo-testnet.org',
        // NOTE: Set CELO_SEPOLIA_USDT_ADDRESS when using testnet mode on Celo.
        usdtAddress: getOptionalConfigString('CELO_SEPOLIA_USDT_ADDRESS') ?? '',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'celo:11142220',
      },
      tron: {
        name: CHAIN_DISPLAY_NAMES.tron,
        chainId: 0,
        rpcUrl: getOptionalConfigString('TRON_NILE_RPC_URL') ?? 'https://nile.trongrid.io',
        usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        blockTimeSeconds: 3,
        isTestnet: true,
        wdkChainId: 'tron:nile',
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
    },
    polygon: {
      name: CHAIN_DISPLAY_NAMES.polygon,
      chainId: 137,
      rpcUrl: getOptionalConfigString('POLYGON_RPC_URL') ?? '',
      usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'polygon:137',
    },
    arbitrum: {
      name: CHAIN_DISPLAY_NAMES.arbitrum,
      chainId: 42161,
      rpcUrl: getOptionalConfigString('ARBITRUM_RPC_URL') ?? '',
      usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      blockTimeSeconds: 1,
      isTestnet: false,
      wdkChainId: 'arbitrum:42161',
    },
    avalanche: {
      name: CHAIN_DISPLAY_NAMES.avalanche,
      chainId: 43114,
      rpcUrl: getOptionalConfigString('AVALANCHE_RPC_URL') ?? 'https://api.avax.network/ext/bc/C/rpc',
      usdtAddress: '0x9702230A8EA53601f5cD2dc00fDBC13d4dF4A8c7',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'avalanche:43114',
    },
    celo: {
      name: CHAIN_DISPLAY_NAMES.celo,
      chainId: 42220,
      rpcUrl: getOptionalConfigString('CELO_RPC_URL') ?? 'https://forno.celo.org',
      usdtAddress: '0x48065fbBE25f71C9282ddf5e1CD6D6A887483D5e',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'celo:42220',
    },
    tron: {
      name: CHAIN_DISPLAY_NAMES.tron,
      chainId: 0,
      rpcUrl: getOptionalConfigString('TRON_RPC_URL') ?? '',
      usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      blockTimeSeconds: 3,
      isTestnet: false,
      wdkChainId: 'tron:mainnet',
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

export function getChainConfig(chain: SupportedChain): ChainConfig {
  return buildChainConfigs(isTestnetEnabled())[chain];
}

/** Convenience helper used by callers that want to pass testnet flag explicitly */
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
  return HD_PATH_PREFIX[chain];
}

export function getChainDisplayName(chain?: string | null): string {
  const normalizedChain = normalizeChain(chain);
  return CHAIN_DISPLAY_NAMES[normalizedChain ?? getDefaultChain()];
}

export function isEvmChain(chain: SupportedChain): boolean {
  return chain !== 'tron';
}
