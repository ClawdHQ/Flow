import crypto from 'crypto';
import type { SupportedChain } from '../config/chains.js';
import {
  getChainConfig,
  getHdPathPrefix,
  getPoolHomeChain,
  getWalletFamilyForChain,
  isBridgeEligibleChain,
  isIndexerBackedChain,
} from '../config/chains.js';
import { config } from '../config/index.js';
import type { WalletCapabilitySet, WalletFamily, WalletRole } from '../types/flow.js';

export interface WalletRegistration {
  family: WalletFamily;
  role: WalletRole;
  chain: SupportedChain;
  hdPath: string;
  live: boolean;
  capabilities: WalletCapabilitySet;
}

function demoAddress(chain: SupportedChain, suffix: string): string {
  const hash = crypto.createHash('sha256').update(`${chain}:${suffix}`).digest('hex');
  if (chain === 'bitcoin') {
    const prefix = getChainConfig(chain).isTestnet ? 'tb1q' : 'bc1q';
    return `${prefix}${hash.slice(0, 38)}`;
  }
  if (chain === 'ton') {
    const prefix = getChainConfig(chain).isTestnet ? 'kQ' : 'EQ';
    return `${prefix}${Buffer.from(hash, 'hex').toString('base64url').slice(0, 46)}`;
  }
  return hash;
}

function buildCapabilities(chain: SupportedChain, role: WalletRole): WalletCapabilitySet {
  const family = getWalletFamilyForChain(chain, role);
  return {
    live: (
      family === 'evm' ||
      family === 'tron_gasfree' ||
      (family === 'evm_erc4337' && config.FLOW_ENABLE_LIVE_ERC4337) ||
      (family === 'btc' && config.FLOW_ENABLE_LIVE_BTC_WALLET) ||
      ((family === 'ton' || family === 'ton_gasless') && config.FLOW_ENABLE_LIVE_TON_WALLET)
    ),
    sponsoredGas: family === 'evm_erc4337',
    gasless: family === 'evm_erc4337' || family === 'tron_gasfree' || family === 'ton_gasless',
    bridgeable: role === 'pool' || isBridgeEligibleChain(chain),
    chainNativeAuth: true,
    indexerBacked: isIndexerBackedChain(chain) || config.FLOW_ENABLE_LIVE_INDEXER,
  };
}

export function getWalletRegistration(chain: SupportedChain, role: WalletRole, index: number): WalletRegistration {
  const hdPrefix = getHdPathPrefix(chain);
  const suffix =
    role === 'pool'
      ? "0'/0/0"
      : role === 'creator'
        ? `1'/0/${index}`
        : role === 'escrow'
          ? `2'/0/${index}`
          : `3'/0/${index}`;

  return {
    family: getWalletFamilyForChain(chain, role),
    role,
    chain,
    hdPath: `${hdPrefix}/${suffix}`,
    live: buildCapabilities(chain, role).live,
    capabilities: buildCapabilities(chain, role),
  };
}

export function getPoolRegistration(): WalletRegistration {
  return getWalletRegistration(getPoolHomeChain(), 'pool', 0);
}

export function deriveDemoAddress(chain: SupportedChain, role: WalletRole, index: number): string {
  return demoAddress(chain, `${role}:${index}:${getHdPathPrefix(chain)}`);
}
