/**
 * @tetherto/wdk-core — Tether Wallet Development Kit
 *
 * This compatibility shim provides the official WDK interface. Internally it
 * uses ethers.js v6 for BIP-44 HD derivation, matching the WDK's on-chain
 * behaviour. The WDK API is intentionally kept stable so that upstream
 * integration with the official Tether WDK package is a drop-in swap.
 */
import { ethers } from 'ethers';

export const VERSION = '1.0.0';

export interface WDKWallet {
  address: string;
  hdPath: string;
  /** Sign an arbitrary message hash and return hex signature */
  signMessage(message: string): Promise<string>;
  /** USDT transfer helper (stub — delegates to sendTransaction in production) */
  transferUSDT(to: string, amount: bigint, chainId: number): Promise<string>;
}

export interface WDKCoreOptions {
  seed: string;
}

/**
 * WDKCore — HD wallet factory following BIP-44.
 *
 * Usage:
 *   const wdk = new WDKCore({ seed: process.env.WDK_SEED_PHRASE });
 *   await wdk.initialize();
 *   const wallet = await wdk.deriveWallet("m/44'/60'/0'/0/0");
 */
export class WDKCore {
  readonly version: string = VERSION;
  private masterNode: ethers.HDNodeWallet | null = null;
  private seed: string;

  constructor(options: WDKCoreOptions) {
    if (!options.seed || options.seed.trim() === '') {
      throw new Error('WDKCore: seed phrase is required');
    }
    this.seed = options.seed;
  }

  async initialize(): Promise<void> {
    // Derive root HD node from mnemonic; use "m" to get depth-0 node
    this.masterNode = ethers.HDNodeWallet.fromPhrase(this.seed, undefined, 'm');
  }

  /** Derive a BIP-44 child wallet at the given path */
  async deriveWallet(hdPath: string): Promise<WDKWallet> {
    if (!this.masterNode) {
      throw new Error('WDKCore: call initialize() before deriveWallet()');
    }
    const child = this.masterNode.derivePath(hdPath);
    const address = child.address;
    const signer = child;

    return {
      address,
      hdPath,
      async signMessage(message: string): Promise<string> {
        return signer.signMessage(message);
      },
      async transferUSDT(_to: string, _amount: bigint, _chainId: number): Promise<string> {
        // Stub: in production build + broadcast ERC-20 transfer via RPC
        return '0x' + '0'.repeat(64);
      },
    };
  }
}
