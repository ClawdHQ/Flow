import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { Address as TonAddress } from '@ton/core';
import { getChainConfig, getDefaultChain, normalizeChain, SupportedChain } from '../config/chains.js';

function isProbablyBitcoinAddress(address: string, chain: SupportedChain): boolean {
  const normalized = address.trim().toLowerCase();
  const prefix = getChainConfig(chain).addressPrefix?.toLowerCase();
  if (!prefix) {
    return false;
  }
  return normalized.startsWith(prefix) || normalized.startsWith(chain === 'bitcoin' && getChainConfig(chain).isTestnet ? 'tb1' : 'bc1');
}

export function resolveSupportedChain(chain?: string | null): SupportedChain {
  return normalizeChain(chain) ?? getDefaultChain();
}

export function normalizeWalletAddress(address: string, chain: SupportedChain): string {
  if (chain === 'tron') {
    if (!TronWeb.isAddress(address)) {
      throw new Error('Invalid TRON address format.');
    }
    return TronWeb.address.fromHex(TronWeb.address.toHex(address));
  }

  if (chain === 'ton') {
    return TonAddress.parse(address).toString();
  }

  if (chain === 'bitcoin') {
    if (!isProbablyBitcoinAddress(address, chain)) {
      throw new Error('Invalid Bitcoin address format.');
    }
    return address.trim().toLowerCase();
  }

  return ethers.getAddress(address);
}

export function isValidWalletAddress(address: string, chain: SupportedChain): boolean {
  try {
    normalizeWalletAddress(address, chain);
    return true;
  } catch {
    return false;
  }
}
