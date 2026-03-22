import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { getDefaultChain, normalizeChain, SupportedChain } from '../config/chains.js';

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
