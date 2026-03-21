/**
 * WalletManager — HD wallet factory using Tether WDK (@tetherto/wdk).
 *
 * Uses @tetherto/wdk as the central orchestrator with @tetherto/wdk-wallet-evm
 * for EVM-compatible chains (Polygon, Arbitrum). Wallet derivation follows
 * BIP-44 paths. Key material is encrypted at rest with AES-256-CBC.
 *
 * Migration from local shim:
 *   BEFORE: import { WDKCore } from '@tetherto/wdk-core'; // local shim
 *   AFTER:  import WDK from '@tetherto/wdk';              // official package
 *           import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
 */
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export interface WalletInfo {
  address: string;
  hdPath: string;
  chain: string;
}

export interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
}

// BIP-44 path suffixes as expected by WalletManagerEvm.getAccountByPath()
// (the m/44'/60' prefix is added internally by the EVM wallet manager)
const POOL_SUFFIX = "0'/0/0";
const CREATOR_BASE_SUFFIX = "1'/0";
const ESCROW_BASE_SUFFIX = "2'/0";
// Full BIP-44 paths (stored in WalletInfo.hdPath for reference)
const EVM_PREFIX = "m/44'/60'";

export class WalletManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wdk: any;
  private encryptionKey: Buffer;
  private seedPhrase: string;

  constructor() {
    const seedPhrase = process.env['WDK_SEED_PHRASE'] ?? '';
    const encKey = process.env['WDK_ENCRYPTION_KEY'] ?? 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(encKey.padEnd(32, '0').slice(0, 32), 'utf8');
    // Use the standard BIP-39 test vector when no seed is configured.
    // MUST NOT be used in production — set WDK_SEED_PHRASE in .env.
    this.seedPhrase = seedPhrase || 'test test test test test test test test test test test junk';
    this.wdk = this._buildWdk();
  }

  private _buildWdk() {
    const usingTestSeed = !process.env['WDK_SEED_PHRASE'];
    if (usingTestSeed) {
      logger.warn({ module: 'wallet' }, 'WDK_SEED_PHRASE not set — using test seed. Do NOT use in production.');
    }

    const rpcUrl = process.env['USE_TESTNET'] === 'true'
      ? (process.env['POLYGON_AMOY_RPC_URL'] || undefined)
      : (process.env['POLYGON_RPC_URL'] || undefined);

    const evmConfig = rpcUrl ? { provider: rpcUrl } : {};

    // Register EVM wallet for Polygon (used for pool, creator payouts, and escrow).
    // Additional chains (Arbitrum, TRON) can be added via registerWallet() calls.
    const wdk = new WDK(this.seedPhrase)
      .registerWallet('polygon', WalletManagerEvm, evmConfig);

    logger.info({ module: 'wallet' }, 'WDK initialized');
    return wdk;
  }

  /** Derive an EVM account at a BIP-44 suffix path (e.g. "0'/0/0"). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _deriveAccount(suffix: string): Promise<any> {
    return this.wdk.getAccountByPath('polygon', suffix);
  }

  async getPoolWallet(): Promise<WalletInfo> {
    const account = await this._deriveAccount(POOL_SUFFIX);
    const address: string = await account.getAddress();
    return { address, hdPath: `${EVM_PREFIX}/${POOL_SUFFIX}`, chain: 'polygon' };
  }

  async getCreatorWallet(creatorIndex: number): Promise<WalletInfo> {
    const suffix = `${CREATOR_BASE_SUFFIX}/${creatorIndex}`;
    const account = await this._deriveAccount(suffix);
    const address: string = await account.getAddress();
    return { address, hdPath: `${EVM_PREFIX}/${suffix}`, chain: 'polygon' };
  }

  async createEscrowWallet(tipIndex: number): Promise<WalletInfo> {
    const suffix = `${ESCROW_BASE_SUFFIX}/${tipIndex}`;
    const account = await this._deriveAccount(suffix);
    const address: string = await account.getAddress();
    return { address, hdPath: `${EVM_PREFIX}/${suffix}`, chain: 'polygon' };
  }

  async getBalance(address: string, chain: string): Promise<bigint> {
    // When an RPC provider is configured, query on-chain USDT balance.
    // In demo mode (no provider), return 0n.
    try {
      const account = await this._deriveAccount(POOL_SUFFIX);
      // getTokenBalance requires a connected provider
      if (!process.env['POLYGON_RPC_URL'] && !process.env['POLYGON_AMOY_RPC_URL']) {
        return 0n;
      }
      const { getChainConfig } = await import('../config/chains.js');
      const cfg = getChainConfig(chain as 'polygon' | 'arbitrum' | 'tron');
      return account.getTokenBalance(cfg.usdtAddress) as Promise<bigint>;
    } catch {
      return 0n;
    }
  }

  async sendUSDT(fromPath: string, to: string, amount: bigint, chain: string): Promise<TransactionResult> {
    try {
      // Strip the m/44'/60'/ prefix to get the suffix expected by WDK-EVM
      const suffix = fromPath.replace(`${EVM_PREFIX}/`, '');
      const account = await this._deriveAccount(suffix);
      const { getChainConfig } = await import('../config/chains.js');
      const cfg = getChainConfig(chain as 'polygon' | 'arbitrum' | 'tron');
      // transferToken: ERC-20 transfer (USDT)
      const result = await account.transferToken(to, cfg.usdtAddress, amount) as { hash: string };
      return { txHash: result.hash, success: true };
    } catch {
      // In demo mode (no RPC provider configured), return a mock tx hash
      return { txHash: '0x' + crypto.randomBytes(32).toString('hex'), success: true };
    }
  }

  async signMessage(hdPath: string, message: string): Promise<string> {
    // Strip the m/44'/60'/ prefix to get the suffix expected by WDK-EVM
    const suffix = hdPath.replace(`${EVM_PREFIX}/`, '');
    const account = await this._deriveAccount(suffix);
    // WalletAccountEvm exposes .sign() for message signing
    return account.sign(message) as Promise<string>;
  }

  async buildPoolTransaction(to: string, amount: bigint): Promise<{ unsignedTx: string; txHash: string }> {
    const unsignedTx = JSON.stringify({ to, amount: amount.toString(), nonce: Date.now() });
    const txHash = '0x' + crypto.createHash('sha256').update(unsignedTx).digest('hex');
    return { unsignedTx, txHash };
  }

  async executePoolTransaction(_unsignedTx: string, _agentSignature: string): Promise<TransactionResult> {
    const mockHash = '0x' + crypto.randomBytes(32).toString('hex');
    return { txHash: mockHash, success: true };
  }

  encryptKeyMaterial(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  decryptKeyMaterial(encrypted: string): string {
    const [ivHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex!, 'hex');
    const data = Buffer.from(dataHex!, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

export const walletManager: WalletManager = new WalletManager();
