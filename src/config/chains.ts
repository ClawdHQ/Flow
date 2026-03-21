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

export type SupportedChain = 'polygon' | 'arbitrum' | 'tron';

function buildChainConfigs(testnet: boolean): Record<SupportedChain, ChainConfig> {
  if (testnet) {
    return {
      polygon: {
        name: 'Polygon Amoy (testnet)',
        chainId: 80002,
        rpcUrl: (config as Record<string, unknown>)['POLYGON_AMOY_RPC_URL'] as string ?? 'https://rpc-amoy.polygon.technology',
        // NOTE: Verify with Tether's official testnet deployments before production use
        usdtAddress: '0x1E3f675Cd66Ef9C0fb04Ace98C6Cf60E6Cf22fC',
        blockTimeSeconds: 2,
        isTestnet: true,
        wdkChainId: 'polygon:80002',
      },
      arbitrum: {
        name: 'Arbitrum Sepolia (testnet)',
        chainId: 421614,
        rpcUrl: (config as Record<string, unknown>)['ARBITRUM_SEPOLIA_RPC_URL'] as string ?? 'https://sepolia-rollup.arbitrum.io/rpc',
        // NOTE: Verify with Tether's official testnet deployments before production use
        usdtAddress: '0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63',
        blockTimeSeconds: 1,
        isTestnet: true,
        wdkChainId: 'arbitrum:421614',
      },
      tron: {
        name: 'TRON Nile (testnet)',
        chainId: 0,
        rpcUrl: 'https://nile.trongrid.io',
        usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        blockTimeSeconds: 3,
        isTestnet: true,
        wdkChainId: 'tron:nile',
      },
    };
  }

  return {
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: (config as Record<string, unknown>)['POLYGON_RPC_URL'] as string ?? '',
      usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      blockTimeSeconds: 2,
      isTestnet: false,
      wdkChainId: 'polygon:137',
    },
    arbitrum: {
      name: 'Arbitrum One',
      chainId: 42161,
      rpcUrl: (config as Record<string, unknown>)['ARBITRUM_RPC_URL'] as string ?? '',
      usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      blockTimeSeconds: 1,
      isTestnet: false,
      wdkChainId: 'arbitrum:42161',
    },
    tron: {
      name: 'Tron',
      chainId: 0,
      rpcUrl: (config as Record<string, unknown>)['TRON_RPC_URL'] as string ?? '',
      usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      blockTimeSeconds: 3,
      isTestnet: false,
      wdkChainId: 'tron:mainnet',
    },
  };
}

export function getChainConfig(chain: SupportedChain): ChainConfig {
  const testnet =
    process.env['USE_TESTNET'] === 'true' ||
    (config as Record<string, unknown>)['USE_TESTNET'] === true;
  return buildChainConfigs(testnet)[chain];
}

/** Convenience helper used by callers that want to pass testnet flag explicitly */
export function getChain(name: SupportedChain, testnet?: boolean): ChainConfig {
  const useTestnet =
    testnet !== undefined
      ? testnet
      : process.env['USE_TESTNET'] === 'true' ||
        (config as Record<string, unknown>)['USE_TESTNET'] === true;
  return buildChainConfigs(useTestnet)[name];
}
