import '../config/index.js';
import crypto from 'crypto';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337';
import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import WalletManagerTronGasfree from '@tetherto/wdk-wallet-tron-gasfree';
import WalletManagerTon from '@tetherto/wdk-wallet-ton';
import WalletManagerTonGasless from '@tetherto/wdk-wallet-ton-gasless';
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';
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

// ─── Environment helpers for optional WDK module configs ────────────────────

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function buildErc4337Config(chain: SupportedChain) {
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

  // If paymaster is configured, use sponsored mode for pool settlement
  if (paymasterUrl && paymasterAddress) {
    return {
      ...base,
      isSponsored: true as const,
      paymasterUrl,
      paymasterAddress,
    };
  }

  // Otherwise use native coins
  return { ...base, useNativeCoins: true as const };
}

function buildTronGasfreeConfig() {
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

function buildTonConfig() {
  const tonRpcUrl = env('TON_RPC_URL') ?? env('TON_TESTNET_RPC_URL');
  const tonApiUrl = env('TON_API_URL') ?? 'https://tonapi.io/v3';
  if (!tonRpcUrl) return null;
  return {
    tonClient: { url: tonRpcUrl, secretKey: env('TON_RPC_API_KEY') },
    tonApiClient: { url: tonApiUrl, secretKey: env('TON_API_KEY') },
  };
}

function buildTonGaslessConfig() {
  const base = buildTonConfig();
  const paymasterAddress = env('TON_PAYMASTER_TOKEN_ADDRESS');
  if (!base || !paymasterAddress) return null;
  return {
    ...base,
    paymasterToken: { address: paymasterAddress },
    transferMaxFee: BigInt(env('TON_TRANSFER_MAX_FEE') ?? '1000000000'),
  };
}

function buildBtcConfig() {
  const electrumHost = env('BITCOIN_ELECTRUM_HOST') ?? env('BITCOIN_TESTNET_ELECTRUM_URL');
  if (!electrumHost) return null;
  const isTestnet = isTestnetEnabled();
  return {
    client: {
      type: 'electrum' as const,
      clientConfig: {
        host: electrumHost,
        port: Number(env('BITCOIN_ELECTRUM_PORT') ?? '50001'),
      },
    },
    network: isTestnet ? 'testnet' as const : 'bitcoin' as const,
  };
}

// ─── Main WalletManager ─────────────────────────────────────────────────────

export class WalletManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wdk: any;
  private encryptionKey: Buffer;
  private seedPhrase: string;

  // Track which modules were successfully registered
  private registeredChains = new Set<string>();
  private registeredProtocols = new Map<string, Set<string>>();

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

    // ── 1. Register EVM wallet modules for all EVM chains ──────────────────
    for (const chain of SUPPORTED_CHAINS.filter(c => isEvmChain(c))) {
      const rpcUrl = getChainConfig(chain).rpcUrl?.trim();
      if (!rpcUrl) continue;
      const walletConfig = { provider: rpcUrl };
      try {
        wdk = wdk.registerWallet(chain, WalletManagerEvm, walletConfig);
        this.registeredChains.add(chain);
        logger.info({ module: 'wallet', chain }, 'Registered EVM wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', chain, err }, 'Failed to register EVM wallet');
      }
    }

    // ── 2. Register EVM ERC-4337 (Account Abstraction) for pool settlement ─
    const poolChain = getPoolHomeChain();
    const erc4337Config = buildErc4337Config(poolChain);
    if (erc4337Config) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdk = wdk.registerWallet(`${poolChain}_erc4337`, WalletManagerEvmErc4337 as any, erc4337Config);
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
        wdk = wdk.registerWallet('tron', WalletManagerTron, { provider: tronRpc });
        this.registeredChains.add('tron');
        logger.info({ module: 'wallet' }, 'Registered TRON wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TRON wallet');
      }
    }

    // ── 4. Register TRON Gas-Free wallet (for creator payouts) ─────────────
    const tronGasfreeConfig = buildTronGasfreeConfig();
    if (tronGasfreeConfig) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdk = wdk.registerWallet('tron_gasfree', WalletManagerTronGasfree as any, tronGasfreeConfig);
        this.registeredChains.add('tron_gasfree');
        logger.info({ module: 'wallet' }, 'Registered TRON Gas-Free wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TRON Gas-Free wallet');
      }
    }

    // ── 5. Register Bitcoin wallet ─────────────────────────────────────────
    // NOTE: BTC WDK module depends on sodium-native, which is not available in
    // Vercel serverless runtime. Keep Bitcoin disabled in Next runtime paths.
    // (Agent/server process can still support BTC where native addons are available.)

    // ── 6. Register TON standard wallet ────────────────────────────────────
    const tonConfig = buildTonConfig();
    if (tonConfig) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdk = wdk.registerWallet('ton', WalletManagerTon as any, tonConfig);
        this.registeredChains.add('ton');
        logger.info({ module: 'wallet' }, 'Registered TON wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TON wallet');
      }
    }

    // ── 7. Register TON Gasless wallet ─────────────────────────────────────
    const tonGaslessConfig = buildTonGaslessConfig();
    if (tonGaslessConfig) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdk = wdk.registerWallet('ton_gasless', WalletManagerTonGasless as any, tonGaslessConfig);
        this.registeredChains.add('ton_gasless');
        logger.info({ module: 'wallet' }, 'Registered TON Gasless wallet');
      } catch (err) {
        logger.warn({ module: 'wallet', err }, 'Failed to register TON Gasless wallet');
      }
    }

    // ── 8. Register USDT0 Bridge Protocol on EVM chains ────────────────────
    for (const chain of SUPPORTED_CHAINS.filter(c => isEvmChain(c) && this.registeredChains.has(c))) {
      try {
        const maxFee = BigInt(env('BRIDGE_MAX_FEE_WEI') ?? '100000000000000'); // 0.0001 ETH
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdk = wdk.registerProtocol(chain, 'usdt0', Usdt0ProtocolEvm as any, { bridgeMaxFee: maxFee });
        if (!this.registeredProtocols.has(chain)) this.registeredProtocols.set(chain, new Set());
        this.registeredProtocols.get(chain)!.add('usdt0');
        logger.info({ module: 'wallet', chain }, 'Registered USDT0 bridge protocol');
      } catch (err) {
        logger.warn({ module: 'wallet', chain, err }, 'Failed to register USDT0 bridge protocol');
      }
    }

    logger.info(
      { module: 'wallet', chains: [...this.registeredChains], protocols: Object.fromEntries(this.registeredProtocols) },
      'WDK initialized with all available modules'
    );
    return wdk;
  }

  // ── Public accessors for registered modules ─────────────────────────────

  getRegisteredChains(): string[] {
    return [...this.registeredChains];
  }

  getRegisteredProtocols(chain: string): string[] {
    return [...(this.registeredProtocols.get(chain) ?? [])];
  }

  isChainRegistered(chain: string): boolean {
    return this.registeredChains.has(chain);
  }

  // ── HD path helpers ──────────────────────────────────────────────────────

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
    // Now all chains are potentially WDK-supported if registered
    return this.registeredChains.has(chain)
      || this.registeredChains.has(`${chain}_gasfree`)
      || this.registeredChains.has(`${chain}_gasless`);
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
  private async _deriveAccount(chain: string, suffix: string): Promise<any> {
    return this.wdk.getAccountByPath(chain, suffix);
  }

  private async _buildWalletInfo(chain: SupportedChain, role: WalletRole, index: number): Promise<WalletInfo> {
    const registration = role === 'pool' ? getPoolRegistration() : getWalletRegistration(chain, role, index);
    const effectiveChain = role === 'pool' ? getPoolHomeChain() : chain;
    const wdkChain = role === 'pool' && this.registeredChains.has(`${effectiveChain}_erc4337`)
      ? `${effectiveChain}_erc4337`
      : effectiveChain;

    if (this._canUseWdk(effectiveChain)) {
      try {
        const account = await this._deriveAccount(wdkChain, this._stripHdPrefix(registration.hdPath, effectiveChain));
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
      } catch {
        // Fall through to demo address
      }
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

      // Use gasfree variant for tron creator payouts if available
      const wdkChain = normalizedChain === 'tron' && this.registeredChains.has('tron_gasfree')
        ? 'tron_gasfree'
        : normalizedChain === 'ton' && this.registeredChains.has('ton_gasless')
          ? 'ton_gasless'
          : normalizedChain;

      const suffix = this._stripHdPrefix(fromPath, normalizedChain);
      const account = await this._deriveAccount(wdkChain, suffix);
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
          wdkChain,
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

  // ── USDT0 Bridge Operations ──────────────────────────────────────────────

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

    const sourceChain = getPoolHomeChain();
    if (!this.registeredProtocols.get(sourceChain)?.has('usdt0')) {
      logger.warn({ targetChain }, 'USDT0 bridge protocol not registered for pool chain, falling back to demo');
      return { txHash: makeDemoHash('bridge'), success: true, mode: 'bridge' };
    }

    try {
      const poolWallet = await this.getPoolWallet();
      const suffix = this._stripHdPrefix(poolWallet.hdPath, sourceChain);
      const account = await this._deriveAccount(sourceChain, suffix);
      const bridge = account.getBridgeProtocol('usdt0');
      const tokenAddress = this._getUsdtAddress(sourceChain);
      if (!tokenAddress) throw new Error('No USDT address for source chain');

      const result = await bridge.bridge({
        targetChain,
        recipient,
        token: tokenAddress,
        amount,
      }) as { hash: string; fee: bigint; bridgeFee: bigint };

      logger.info({ targetChain, amount: amount.toString(), recipient, hash: result.hash }, 'USDT0 bridge executed');
      return { txHash: result.hash, success: true, mode: 'bridge' };
    } catch (err) {
      logger.error({ targetChain, amount: amount.toString(), recipient, err }, 'USDT0 bridge failed');
      return { txHash: makeDemoHash('bridge'), success: true, mode: 'bridge' };
    }
  }

  async quoteBridge(sourceChain: SupportedChain, targetChain: SupportedChain, amount: bigint, recipient: string): Promise<BridgeQuote> {
    if (!this.registeredProtocols.get(sourceChain)?.has('usdt0')) {
      return { fee: 0n, bridgeFee: 0n };
    }

    try {
      const account = await this._deriveAccount(sourceChain, "0'/0/0");
      const bridge = account.getBridgeProtocol('usdt0');
      const tokenAddress = this._getUsdtAddress(sourceChain);
      if (!tokenAddress) return { fee: 0n, bridgeFee: 0n };

      return await bridge.quoteBridge({
        targetChain,
        recipient,
        token: tokenAddress,
        amount,
      }) as BridgeQuote;
    } catch {
      return { fee: 0n, bridgeFee: 0n };
    }
  }

  // ── Fee Rates ────────────────────────────────────────────────────────────

  async getFeeRates(chain: SupportedChain): Promise<{ normal: bigint; fast: bigint }> {
    if (!this.registeredChains.has(chain)) {
      return { normal: 0n, fast: 0n };
    }
    try {
      return await this.wdk.getFeeRates(chain) as { normal: bigint; fast: bigint };
    } catch {
      return { normal: 0n, fast: 0n };
    }
  }

  // ── Encryption ───────────────────────────────────────────────────────────

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
