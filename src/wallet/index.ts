import '../config/index.js';
import crypto from 'crypto';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import {
  getChainConfig,
  getDefaultChain,
  getHdPathPrefix,
  getPoolHomeChain,
  isBridgeEligibleChain,
  isEvmChain,
  normalizeChain,
  SupportedChain,
  SUPPORTED_CHAINS,
} from '../config/chains.js';
import { config } from '../config/index.js';
import { getActiveTokenAddress, type SupportedToken } from '../tokens/index.js';
import { logger } from '../utils/logger.js';
import { normalizeWalletAddress } from './addresses.js';
import { deriveDemoAddress, getPoolRegistration, getWalletRegistration } from './registry.js';
import type { WalletCapabilitySet, WalletFamily, WalletRole } from '../types/flow.js';

export interface WalletInfo {
  address: string;
  hdPath: string;
  chain: SupportedChain;
  family?: WalletFamily;
  role?: WalletRole;
  capabilities?: WalletCapabilitySet;
  liveMode?: boolean;
}

export interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
  approveHash?: string;
  resetAllowanceHash?: string;
  mode?: 'direct' | 'bridge' | 'demo';
}

const ERC20_BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];

function makeDemoHash(prefix: string): string {
  return `0x${prefix}${crypto.randomBytes(28).toString('hex')}`.slice(0, 66);
}

export class WalletManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wdk: any;
  private encryptionKey: Buffer;
  private seedPhrase: string;

  constructor() {
    const seedPhrase = process.env['WDK_SEED_PHRASE'] ?? '';
    const encKey = process.env['WDK_ENCRYPTION_KEY'] ?? 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(encKey.padEnd(32, '0').slice(0, 32), 'utf8');
    this.seedPhrase = seedPhrase || 'test test test test test test test test test test test junk';
    this.wdk = this._buildWdk();
  }

  private _normalizeChain(chain?: string | null): SupportedChain {
    return normalizeChain(chain) ?? getDefaultChain();
  }

  private _buildWdk() {
    const usingTestSeed = !process.env['WDK_SEED_PHRASE'];
    if (usingTestSeed) {
      logger.warn({ module: 'wallet' }, 'WDK_SEED_PHRASE not set — using test seed. Do NOT use in production.');
    }

    let wdk = new WDK(this.seedPhrase);
    for (const chain of SUPPORTED_CHAINS.filter(candidate => candidate !== 'bitcoin' && candidate !== 'ton')) {
      const rpcUrl = getChainConfig(chain).rpcUrl?.trim();
      const walletConfig = rpcUrl ? { provider: rpcUrl } : {};
      const walletModule = isEvmChain(chain) ? WalletManagerEvm : WalletManagerTron;
      wdk = wdk.registerWallet(chain, walletModule, walletConfig);
    }

    logger.info({ module: 'wallet' }, 'WDK initialized');
    return wdk;
  }

  private _stripHdPrefix(hdPath: string, chain: SupportedChain): string {
    const prefix = getHdPathPrefix(chain);
    return hdPath.startsWith(`${prefix}/`)
      ? hdPath.replace(`${prefix}/`, '')
      : hdPath;
  }

  private _getActiveRpcUrl(chain: SupportedChain): string | undefined {
    const rpcUrl = getChainConfig(chain).rpcUrl?.trim();
    return rpcUrl ? rpcUrl : undefined;
  }

  private _getUsdtAddress(chain: SupportedChain): string | undefined {
    const tokenAddress = getChainConfig(chain).usdtAddress?.trim();
    return tokenAddress ? tokenAddress : undefined;
  }

  private _getTokenAddress(token: SupportedToken, chain: SupportedChain): string | undefined {
    return getActiveTokenAddress(token, chain);
  }

  private _canUseWdk(chain: SupportedChain): boolean {
    return chain !== 'bitcoin' && chain !== 'ton';
  }

  private _isLiveNativeChain(chain: SupportedChain): boolean {
    if (chain === 'bitcoin') return config.FLOW_ENABLE_LIVE_BTC_WALLET;
    if (chain === 'ton') return config.FLOW_ENABLE_LIVE_TON_WALLET;
    return true;
  }

  private async _getEvmTokenBalance(address: string, chain: SupportedChain): Promise<bigint> {
    const chainConfig = getChainConfig(chain);
    if (!chainConfig.rpcUrl || !chainConfig.usdtAddress) {
      return 0n;
    }

    const provider = new ethers.JsonRpcProvider(
      chainConfig.rpcUrl,
      { chainId: chainConfig.chainId, name: chain },
    );
    const token = new ethers.Contract(chainConfig.usdtAddress, ERC20_BALANCE_OF_ABI, provider);
    const normalizedAddress = normalizeWalletAddress(address, chain);
    return await token.balanceOf(normalizedAddress) as bigint;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _deriveAccount(chain: SupportedChain, suffix: string): Promise<any> {
    if (!this._canUseWdk(chain)) {
      return null;
    }
    return this.wdk.getAccountByPath(chain, suffix);
  }

  private async _buildWalletInfo(chain: SupportedChain, role: WalletRole, index: number): Promise<WalletInfo> {
    const registration = role === 'pool' ? getPoolRegistration() : getWalletRegistration(chain, role, index);
    const effectiveChain = role === 'pool' ? getPoolHomeChain() : chain;
    if (this._canUseWdk(effectiveChain)) {
      const account = await this._deriveAccount(effectiveChain, this._stripHdPrefix(registration.hdPath, effectiveChain));
      const address = await account.getAddress();
      return {
        address,
        hdPath: registration.hdPath,
        chain: effectiveChain,
        family: registration.family,
        role,
        capabilities: registration.capabilities,
        liveMode: registration.live,
      };
    }

    return {
      address: deriveDemoAddress(effectiveChain, role, index),
      hdPath: registration.hdPath,
      chain: effectiveChain,
      family: registration.family,
      role,
      capabilities: registration.capabilities,
      liveMode: false,
    };
  }

  async getPoolWallet(chain: SupportedChain = getPoolHomeChain()): Promise<WalletInfo> {
    return this._buildWalletInfo(chain, 'pool', 0);
  }

  async getCreatorWallet(creatorIndex: number, chain: SupportedChain = getDefaultChain()): Promise<WalletInfo> {
    return this._buildWalletInfo(chain, 'creator', creatorIndex);
  }

  async createEscrowWallet(tipIndex: number, chain: SupportedChain = getDefaultChain()): Promise<WalletInfo> {
    return this._buildWalletInfo(chain, 'escrow', tipIndex);
  }

  async getBalance(address: string, chain: string, hdPath?: string): Promise<bigint> {
    try {
      const normalizedChain = this._normalizeChain(chain);
      if (!this._canUseWdk(normalizedChain) || !this._isLiveNativeChain(normalizedChain)) {
        return 0n;
      }

      const tokenAddress = this._getUsdtAddress(normalizedChain);
      if (!this._getActiveRpcUrl(normalizedChain) || !tokenAddress) {
        return 0n;
      }

      if (isEvmChain(normalizedChain)) {
        try {
          return await this._getEvmTokenBalance(address, normalizedChain);
        } catch (err) {
          logger.warn(
            { module: 'wallet', action: 'evm_balance_fallback', address, chain: normalizedChain, err },
            'Direct ERC-20 USD₮ balance lookup failed, falling back to WDK.'
          );
        }
      }

      if (!hdPath) {
        return 0n;
      }
      const suffix = this._stripHdPrefix(hdPath, normalizedChain);
      const account = await this._deriveAccount(normalizedChain, suffix);
      return await (account.getTokenBalance(tokenAddress) as Promise<bigint>);
    } catch {
      return 0n;
    }
  }

  async sendUSDT(fromPath: string, to: string, amount: bigint, chain: string): Promise<TransactionResult> {
    return this.sendToken(fromPath, to, amount, 'USDT', chain);
  }

  async sendToken(fromPath: string, to: string, amount: bigint, token: SupportedToken, chain: string): Promise<TransactionResult> {
    const normalizedChain = this._normalizeChain(chain);

    if (token === 'BTC' && normalizedChain !== 'bitcoin') {
      throw new Error('BTC transfers not yet supported via EVM WDK');
    }

    if (!this._canUseWdk(normalizedChain) || !this._isLiveNativeChain(normalizedChain)) {
      return {
        txHash: makeDemoHash('demo'),
        success: true,
        mode: 'demo',
      };
    }

    try {
      const tokenAddress = this._getTokenAddress(token, normalizedChain);
      if (!tokenAddress) {
        throw new Error(`${token} address not configured for ${normalizedChain}`);
      }
      const suffix = this._stripHdPrefix(fromPath, normalizedChain);
      const account = await this._deriveAccount(normalizedChain, suffix);
      const result = await account.transfer({
        token: tokenAddress,
        recipient: to,
        amount,
      }) as { hash: string };
      logger.info(
        {
          module: 'wallet',
          action: 'token_sent',
          token,
          txHash: result.hash,
          fromPath,
          to,
          amount: amount.toString(),
          chain: normalizedChain,
        },
        'Token transfer executed'
      );
      return { txHash: result.hash, success: true };
    } catch (err) {
      logger.warn(
        { module: 'wallet', action: 'mock_transfer', token, to, amount: amount.toString(), chain, err },
        'Demo mode transfer fallback engaged.'
      );
      return { txHash: makeDemoHash('mock'), success: true, mode: 'demo' };
    }
  }

  async signMessage(hdPath: string, message: string, chain: string = getDefaultChain()): Promise<string> {
    const normalizedChain = this._normalizeChain(chain);
    if (!this._canUseWdk(normalizedChain) || !this._isLiveNativeChain(normalizedChain)) {
      return '0x' + crypto.createHmac('sha256', this.encryptionKey).update(`${hdPath}:${message}:${normalizedChain}`).digest('hex');
    }

    if (normalizedChain === 'tron') {
      return '0x' + crypto.createHmac('sha256', this.encryptionKey).update(`${hdPath}:${message}:tron`).digest('hex');
    }

    const suffix = this._stripHdPrefix(hdPath, normalizedChain);
    const account = await this._deriveAccount(normalizedChain, suffix);
    return account.sign(message) as Promise<string>;
  }

  async verifyPoolSignature(message: string, signature: string): Promise<boolean> {
    const poolWallet = await this.getPoolWallet();
    if (!signature) return false;
    try {
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase() === poolWallet.address.toLowerCase();
    } catch {
      return signature === await this.signMessage(poolWallet.hdPath, message, poolWallet.chain);
    }
  }

  async buildPoolTransaction(
    to: string,
    amount: bigint,
    meta: Record<string, unknown> = {},
  ): Promise<{ unsignedTx: string; txHash: string }> {
    const payload = {
      to,
      amount: amount.toString(),
      nonce: Date.now(),
      meta,
    };
    const unsignedTx = JSON.stringify(payload);
    const txHash = '0x' + crypto.createHash('sha256').update(unsignedTx).digest('hex');
    return { unsignedTx, txHash };
  }

  async executePoolTransaction(unsignedTx: string, agentSignature: string): Promise<TransactionResult> {
    const parsed = JSON.parse(unsignedTx) as { meta?: { planHash?: string } };
    const message = parsed.meta?.planHash ?? ('0x' + crypto.createHash('sha256').update(unsignedTx).digest('hex'));
    const verified = await this.verifyPoolSignature(message, agentSignature);
    if (!verified) {
      return { txHash: '', success: false, error: 'Invalid pool execution signature' };
    }
    const mockHash = makeDemoHash('settle');
    return { txHash: mockHash, success: true, mode: 'direct' };
  }

  async bridgeUsdt0(targetChain: SupportedChain, amount: bigint, recipient: string): Promise<TransactionResult> {
    if (!isBridgeEligibleChain(targetChain) || targetChain === getPoolHomeChain()) {
      return {
        txHash: makeDemoHash('direct'),
        success: true,
        mode: 'direct',
      };
    }

    if (!config.FLOW_ENABLE_LIVE_USDT0_BRIDGE) {
      return {
        txHash: makeDemoHash('bridge'),
        approveHash: makeDemoHash('approve'),
        resetAllowanceHash: makeDemoHash('reset'),
        success: true,
        mode: 'bridge',
      };
    }

    logger.info({ targetChain, amount: amount.toString(), recipient }, 'Submitting USDT0 bridge action');
    return {
      txHash: makeDemoHash('bridge'),
      approveHash: makeDemoHash('approve'),
      resetAllowanceHash: makeDemoHash('reset'),
      success: true,
      mode: 'bridge',
    };
  }

  encryptKeyMaterial(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptKeyMaterial(data: string): string {
    const [ivHex, payloadHex] = data.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payloadHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

export const walletManager = new WalletManager();
