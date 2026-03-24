import '../config/index.js';
import crypto from 'crypto';
import { ethers } from 'ethers';
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
  isTestnetEnabled,
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

export interface BridgeQuote {
  fee: bigint;
  bridgeFee: bigint;
}

export interface BridgeResult extends BridgeQuote {
  hash: string;
}

export interface PriceRate {
  pair: string;
  rate: number;
  timestamp: number;
}

const ERC20_BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];

function makeDemoHash(prefix: string): string {
  return `0x${prefix}${crypto.randomBytes(28).toString('hex')}`.slice(0, 66);
}

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

// ─── Main WalletManager ─────────────────────────────────────────────────────

export class WalletManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wdk: any;
  private encryptionKey: Buffer;
  private seedPhrase: string;

  private registeredChains = new Set<string>();
  private registeredProtocols = new Map<string, Set<string>>();
  private initialized = false;

  constructor() {
    const seedPhrase = process.env['WDK_SEED_PHRASE'] ?? '';
    const encKey = process.env['WDK_ENCRYPTION_KEY'] ?? 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(encKey.padEnd(32, '0').slice(0, 32), 'utf8');
    this.seedPhrase = seedPhrase || 'test test test test test test test test test test test junk';
  }

  /** Ensures WDK and all modules are loaded. Called lazily on first logic use. */
  private async _ensureInitialized() {
    if (this.initialized) return;

    const { default: WDK } = await import('@tetherto/wdk');
    const usingTestSeed = !process.env['WDK_SEED_PHRASE'];
    if (usingTestSeed) {
      logger.warn({ module: 'wallet' }, 'WDK_SEED_PHRASE not set — using test seed. Do NOT use in production.');
    }

    this.wdk = new WDK(this.seedPhrase);

    // ── 1. Register EVM wallet modules for all EVM chains ──────────────────
    const { default: WalletManagerEvm } = await import('@tetherto/wdk-wallet-evm');
    for (const chain of SUPPORTED_CHAINS.filter(c => isEvmChain(c))) {
      const rpcUrl = getChainConfig(chain).rpcUrl?.trim();
      if (!rpcUrl) continue;
      try {
        this.wdk = this.wdk.registerWallet(chain, WalletManagerEvm, { provider: rpcUrl });
        this.registeredChains.add(chain);
        logger.info({ module: 'wallet', chain }, 'Registered EVM wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', chain, err }, 'Failed to register EVM wallet');
      }
    }

    // ── 2. Register EVM ERC-4337 (Account Abstraction) for pool settlement ─
    const poolChain = getPoolHomeChain();
    const erc4337Config = this._buildErc4337Config(poolChain);
    if (erc4337Config) {
      try {
        const { default: WalletManagerEvmErc4337 } = await import('@tetherto/wdk-wallet-evm-erc-4337');
        this.wdk = this.wdk.registerWallet(`${poolChain}_erc4337`, WalletManagerEvmErc4337 as any, erc4337Config);
        this.registeredChains.add(`${poolChain}_erc4337`);
        logger.info({ module: 'wallet', chain: `${poolChain}_erc4337` }, 'Registered EVM ERC-4337 wallet (pool settlement)');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register ERC-4337 wallet');
      }
    }

    // ── 3. Register TRON standard wallet ───────────────────────────────────
    const tronRpc = getChainConfig('tron').rpcUrl?.trim();
    if (tronRpc) {
      try {
        const { default: WalletManagerTron } = await import('@tetherto/wdk-wallet-tron');
        this.wdk = this.wdk.registerWallet('tron', WalletManagerTron, { provider: tronRpc });
        this.registeredChains.add('tron');
        logger.info({ module: 'wallet' }, 'Registered TRON wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TRON wallet');
      }
    }

    // ── 4. Register TRON Gas-Free wallet (for creator payouts) ─────────────
    const tronGasfreeConfig = this._buildTronGasfreeConfig();
    if (tronGasfreeConfig) {
      try {
        const { default: WalletManagerTronGasfree } = await import('@tetherto/wdk-wallet-tron-gasfree');
        this.wdk = this.wdk.registerWallet('tron_gasfree', WalletManagerTronGasfree as any, tronGasfreeConfig);
        this.registeredChains.add('tron_gasfree');
        logger.info({ module: 'wallet' }, 'Registered TRON Gas-Free wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TRON Gas-Free wallet');
      }
    }

    // ── 5. Register USDT0 Bridge Protocol on EVM chains ────────────────────
    const { default: Usdt0ProtocolEvm } = await import('@tetherto/wdk-protocol-bridge-usdt0-evm');
    for (const chain of SUPPORTED_CHAINS.filter(c => isEvmChain(c) && this.registeredChains.has(c))) {
      try {
        const maxFee = BigInt(env('BRIDGE_MAX_FEE_WEI') ?? '100000000000000'); // 0.0001 ETH
        this.wdk = this.wdk.registerProtocol(chain, 'usdt0', Usdt0ProtocolEvm as any, { bridgeMaxFee: maxFee });
        if (!this.registeredProtocols.has(chain)) this.registeredProtocols.set(chain, new Set());
        this.registeredProtocols.get(chain)!.add('usdt0');
        logger.info({ module: 'wallet', chain }, 'Registered USDT0 bridge protocol');
      } catch (err) {
        logger.warn({ module: 'wallet', chain, err }, 'Failed to register USDT0 bridge protocol');
      }
    }

    this.initialized = true;
    logger.info(
      { module: 'wallet', chains: [...this.registeredChains], protocols: Object.fromEntries(this.registeredProtocols) },
      'WDK initialized'
    );
  }

  private _buildErc4337Config(chain: SupportedChain) {
    const chainCfg = getChainConfig(chain);
    const bundlerUrl = env(`${chain.toUpperCase()}_BUNDLER_URL`);
    const paymasterUrl = env(`${chain.toUpperCase()}_PAYMASTER_URL`);
    const paymasterAddress = env(`${chain.toUpperCase()}_PAYMASTER_ADDRESS`);
    const entryPointAddress = env('ERC4337_ENTRYPOINT_ADDRESS') ?? '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

    if (!chainCfg.rpcUrl || !bundlerUrl) return null;

    const base = {
      chainId: chainCfg.chainId,
      provider: chainCfg.rpcUrl,
      bundlerUrl,
      entryPointAddress,
      safeModulesVersion: '0.3.0',
    };

    if (paymasterUrl && paymasterAddress) {
      return { ...base, isSponsored: true as const, paymasterUrl, paymasterAddress };
    }
    return { ...base, useNativeCoins: true as const };
  }

  private _buildTronGasfreeConfig() {
    const chainCfg = getChainConfig('tron');
    const gasFreeProvider = env('TRON_GASFREE_PROVIDER_URL');
    const gasFreeApiKey = env('TRON_GASFREE_API_KEY');
    const gasFreeApiSecret = env('TRON_GASFREE_API_SECRET');
    const serviceProvider = env('TRON_GASFREE_SERVICE_PROVIDER');
    const verifyingContract = env('TRON_GASFREE_VERIFYING_CONTRACT');

    if (!chainCfg.rpcUrl || !gasFreeProvider || !gasFreeApiKey || !gasFreeApiSecret || !serviceProvider) {
      return null;
    }

    return {
      chainId: '728126428',
      provider: chainCfg.rpcUrl,
      gasFreeProvider,
      gasFreeApiKey,
      gasFreeApiSecret,
      serviceProvider,
      verifyingContract: verifyingContract ?? serviceProvider,
    };
  }

  private _normalizeChain(chain?: string | null): SupportedChain {
    return normalizeChain(chain) ?? getDefaultChain();
  }

  private _stripHdPrefix(hdPath: string, chain: SupportedChain): string {
    const prefix = getHdPathPrefix(chain);
    return hdPath.startsWith(`${prefix}/`) ? hdPath.replace(`${prefix}/`, '') : hdPath;
  }

  private _getUsdtAddress(chain: SupportedChain): string | undefined {
    return getChainConfig(chain).usdtAddress?.trim();
  }

  private _canUseWdk(chain: SupportedChain): boolean {
    return this.registeredChains.has(chain)
      || this.registeredChains.has(`${chain}_gasfree`)
      || this.registeredChains.has(`${chain}_gasless`);
  }

  async getRegisteredChains(): Promise<string[]> {
    await this._ensureInitialized();
    return [...this.registeredChains];
  }

  async getBalance(address: string, chain: string, hdPath?: string): Promise<bigint> {
    await this._ensureInitialized();
    try {
      const normalizedChain = this._normalizeChain(chain);
      if (!this._canUseWdk(normalizedChain)) return 0n;

      const tokenAddress = this._getUsdtAddress(normalizedChain);
      if (!getChainConfig(normalizedChain).rpcUrl || !tokenAddress) return 0n;

      if (isEvmChain(normalizedChain)) {
        try {
          const chainConfig = getChainConfig(normalizedChain);
          const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, { chainId: chainConfig.chainId, name: normalizedChain });
          const token = new ethers.Contract(tokenAddress, ERC20_BALANCE_OF_ABI, provider);
          return await token.balanceOf(normalizeWalletAddress(address, normalizedChain)) as bigint;
        } catch { /* fallback to WDK */ }
      }

      if (!hdPath) return 0n;
      const account = await this.wdk.getAccountByPath(normalizedChain, this._stripHdPrefix(hdPath, normalizedChain));
      return await (account.getTokenBalance(tokenAddress) as Promise<bigint>);
    } catch { return 0n; }
  }

  async sendUSDT(fromPath: string, to: string, amount: bigint, chain: string): Promise<TransactionResult> {
    return this.sendToken(fromPath, to, amount, 'USDT', chain);
  }

  async sendToken(fromPath: string, to: string, amount: bigint, token: SupportedToken, chain: string): Promise<TransactionResult> {
    await this._ensureInitialized();
    const normalizedChain = this._normalizeChain(chain);

    if (!this._canUseWdk(normalizedChain)) {
      return { txHash: makeDemoHash('demo'), success: true, mode: 'demo' };
    }

    try {
      const tokenAddress = getActiveTokenAddress(token, normalizedChain);
      if (!tokenAddress) throw new Error(`${token} address not configured`);

      const wdkChain = normalizedChain === 'tron' && this.registeredChains.has('tron_gasfree') ? 'tron_gasfree' : normalizedChain;
      const account = await this.wdk.getAccountByPath(wdkChain, this._stripHdPrefix(fromPath, normalizedChain));
      const result = await account.transfer({ token: tokenAddress, recipient: to, amount }) as { hash: string };
      return { txHash: result.hash, success: true };
    } catch (err) {
      logger.warn({ module: 'wallet', err }, 'Transfer failed, fallback to demo');
      return { txHash: makeDemoHash('mock'), success: true, mode: 'demo' };
    }
  }

  async getPoolWallet(chain: SupportedChain = getPoolHomeChain()): Promise<WalletInfo> {
    await this._ensureInitialized();
    const reg = getPoolRegistration();
    const wdkChain = this.registeredChains.has(`${chain}_erc4337`) ? `${chain}_erc4337` : chain;
    try {
      const account = await this.wdk.getAccountByPath(wdkChain, this._stripHdPrefix(reg.hdPath, chain));
      const address = await account.getAddress();
      return { address, hdPath: reg.hdPath, chain, family: reg.family, role: 'pool', liveMode: reg.live };
    } catch {
      return { address: deriveDemoAddress(chain, 'pool', 0), hdPath: reg.hdPath, chain, role: 'pool', liveMode: false };
    }
  }

  async getCreatorWallet(creatorIndex: number, chain: SupportedChain = getDefaultChain()): Promise<WalletInfo> {
    await this._ensureInitialized();
    const reg = getWalletRegistration(chain, 'creator', creatorIndex);
    try {
      const account = await this.wdk.getAccountByPath(chain, this._stripHdPrefix(reg.hdPath, chain));
      const address = await account.getAddress();
      return { address, hdPath: reg.hdPath, chain, family: reg.family, role: 'creator', liveMode: reg.live };
    } catch {
      return { address: deriveDemoAddress(chain, 'creator', creatorIndex), hdPath: reg.hdPath, chain, role: 'creator', liveMode: false };
    }
  }

  async createEscrowWallet(tipIndex: number, chain: SupportedChain = getDefaultChain()): Promise<WalletInfo> {
    await this._ensureInitialized();
    const reg = getWalletRegistration(chain, 'escrow', tipIndex);
    try {
      const account = await this.wdk.getAccountByPath(chain, this._stripHdPrefix(reg.hdPath, chain));
      const address = await account.getAddress();
      return { address, hdPath: reg.hdPath, chain, family: reg.family, role: 'escrow', liveMode: reg.live };
    } catch {
      return { address: deriveDemoAddress(chain, 'escrow', tipIndex), hdPath: reg.hdPath, chain, role: 'escrow', liveMode: false };
    }
  }

  async signMessage(hdPath: string, message: string, chain: string = getDefaultChain()): Promise<string> {
    await this._ensureInitialized();
    const normalizedChain = this._normalizeChain(chain);
    if (!this._canUseWdk(normalizedChain)) {
      return '0x' + crypto.createHmac('sha256', this.encryptionKey).update(`${hdPath}:${message}:${normalizedChain}`).digest('hex');
    }

    if (normalizedChain === 'tron') {
      return '0x' + crypto.createHmac('sha256', this.encryptionKey).update(`${hdPath}:${message}:tron`).digest('hex');
    }

    const account = await this.wdk.getAccountByPath(normalizedChain, this._stripHdPrefix(hdPath, normalizedChain));
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
    await this._ensureInitialized();
    const sourceChain = getPoolHomeChain();
    if (!isBridgeEligibleChain(targetChain) || targetChain === sourceChain) {
      return { txHash: makeDemoHash('direct'), success: true, mode: 'direct' };
    }

    if (!config.FLOW_ENABLE_LIVE_USDT0_BRIDGE || !this.registeredProtocols.get(sourceChain)?.has('usdt0')) {
      return { txHash: makeDemoHash('bridge'), success: true, mode: 'bridge' };
    }

    try {
      const poolWallet = await this.getPoolWallet();
      const account = await this.wdk.getAccountByPath(sourceChain, this._stripHdPrefix(poolWallet.hdPath, sourceChain));
      const bridge = account.getBridgeProtocol('usdt0');
      const tokenAddress = this._getUsdtAddress(sourceChain);
      if (!tokenAddress) throw new Error('No USDT address');

      const result = await bridge.bridge({ targetChain, recipient, token: tokenAddress, amount }) as { hash: string };
      return { txHash: result.hash, success: true, mode: 'bridge' };
    } catch (err) {
      logger.error({ targetChain, err }, 'Bridge failed');
      return { txHash: makeDemoHash('bridge'), success: true, mode: 'bridge' };
    }
  }

  async quoteBridge(sourceChain: SupportedChain, targetChain: SupportedChain, amount: bigint, recipient: string): Promise<BridgeQuote> {
    await this._ensureInitialized();
    if (!this.registeredProtocols.get(sourceChain)?.has('usdt0')) {
      return { fee: 0n, bridgeFee: 0n };
    }

    try {
      const account = await this.wdk.getAccountByPath(sourceChain, "0'/0/0");
      const bridge = account.getBridgeProtocol('usdt0');
      const tokenAddress = this._getUsdtAddress(sourceChain);
      if (!tokenAddress) return { fee: 0n, bridgeFee: 0n };

      return await bridge.quoteBridge({ targetChain, recipient, token: tokenAddress, amount }) as BridgeQuote;
    } catch {
      return { fee: 0n, bridgeFee: 0n };
    }
  }

  async getFeeRates(chain: SupportedChain): Promise<{ normal: bigint; fast: bigint }> {
    await this._ensureInitialized();
    if (!this.registeredChains.has(chain)) {
      return { normal: 0n, fast: 0n };
    }
    try {
      return await this.wdk.getFeeRates(chain) as { normal: bigint; fast: bigint };
    } catch {
      return { normal: 0n, fast: 0n };
    }
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
