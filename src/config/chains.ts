import { config } from './index.js';

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  usdtAddress: string;
  blockTimeSeconds: number;
}

export type SupportedChain = 'polygon' | 'arbitrum' | 'tron';

export function getChainConfig(chain: SupportedChain): ChainConfig {
  const configs: Record<SupportedChain, ChainConfig> = {
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: (config as Record<string, unknown>)['POLYGON_RPC_URL'] as string ?? '',
      usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      blockTimeSeconds: 2,
    },
    arbitrum: {
      name: 'Arbitrum One',
      chainId: 42161,
      rpcUrl: (config as Record<string, unknown>)['ARBITRUM_RPC_URL'] as string ?? '',
      usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      blockTimeSeconds: 1,
    },
    tron: {
      name: 'Tron',
      chainId: 0,
      rpcUrl: (config as Record<string, unknown>)['TRON_RPC_URL'] as string ?? '',
      usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      blockTimeSeconds: 3,
    },
  };
  return configs[chain];
}
