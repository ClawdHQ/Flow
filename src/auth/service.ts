import crypto from 'crypto';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import WalletManagerBtc from '@tetherto/wdk-wallet-btc';
import WalletManagerTon from '@tetherto/wdk-wallet-ton';
import { config } from '../config/index.js';
import { getChainConfig, isTestnetEnabled, normalizeChain, type SupportedChain } from '../config/chains.js';
import { AuthSessionsRepository } from '../storage/repositories/auth-sessions.js';
import { CreatorAdminWalletsRepository } from '../storage/repositories/creator-admin-wallets.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import type { AuthMethod, WalletFamily } from '../types/flow.js';

interface ConnectManagedWalletInput {
  family: WalletFamily;
  network?: string;
  username?: string;
  creatorId?: string;
  seedPhrase: string;
}

function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function resolveAuthMethod(family: WalletFamily): AuthMethod {
  switch (family) {
    case 'evm':
    case 'evm_erc4337':
      return 'siwe';
    case 'tron_gasfree':
      return 'tron_message';
    case 'btc':
      return 'bip322';
    case 'ton':
    case 'ton_gasless':
      return 'ton_proof';
  }
}

function getDefaultNetworkForFamily(family: WalletFamily): SupportedChain {
  switch (family) {
    case 'evm':
    case 'evm_erc4337':
      return 'polygon';
    case 'tron_gasfree':
      return 'tron';
    case 'btc':
      return 'bitcoin';
    case 'ton':
    case 'ton_gasless':
      return 'ton';
  }
}

function isNetworkCompatibleWithFamily(family: WalletFamily, network: SupportedChain): boolean {
  if (family === 'evm' || family === 'evm_erc4337') {
    return ['ethereum', 'polygon', 'arbitrum', 'avalanche', 'celo'].includes(network);
  }
  if (family === 'tron_gasfree') return network === 'tron';
  if (family === 'btc') return network === 'bitcoin';
  return network === 'ton';
}

function validateSeedPhrase(seedPhrase: string): string {
  const normalized = seedPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const wordCount = normalized.split(' ').length;
  if (![12, 15, 18, 21, 24].includes(wordCount)) {
    throw new Error('Seed phrase must contain 12, 15, 18, 21, or 24 words.');
  }
  return normalized;
}

function getEvmFallbackRpc(chain: SupportedChain): string {
  switch (chain) {
    case 'ethereum':
      return 'https://eth.drpc.org';
    case 'polygon':
      return 'https://polygon-rpc.com';
    case 'arbitrum':
      return 'https://arb1.arbitrum.io/rpc';
    case 'avalanche':
      return 'https://api.avax.network/ext/bc/C/rpc';
    case 'celo':
      return 'https://forno.celo.org';
    default:
      return 'https://polygon-rpc.com';
  }
}

export class AuthService {
  private readonly sessionsRepo = new AuthSessionsRepository();
  private readonly creatorsRepo = new CreatorsRepository();
  private readonly creatorAdminWalletsRepo = new CreatorAdminWalletsRepository();

  static generateSeedPhrase(): string {
    return WDK.getRandomSeedPhrase();
  }

  private async deriveAddressFromSeed(seedPhrase: string, family: WalletFamily, network: SupportedChain): Promise<string> {
    let wdk = new WDK(seedPhrase);

    if (family === 'evm' || family === 'evm_erc4337') {
      const rpc = getChainConfig(network).rpcUrl || getEvmFallbackRpc(network);
      wdk = wdk.registerWallet(network, WalletManagerEvm, { provider: rpc });
      const account = await wdk.getAccountByPath(network, "0'/0/0");
      return await account.getAddress();
    }

    if (family === 'tron_gasfree') {
      const rpc = getChainConfig('tron').rpcUrl || 'https://api.trongrid.io';
      wdk = wdk.registerWallet('tron', WalletManagerTron, { provider: rpc });
      const account = await wdk.getAccountByPath('tron', "0'/0/0");
      return await account.getAddress();
    }

    if (family === 'btc') {
      const host = process.env['BITCOIN_ELECTRUM_HOST']
        ?? process.env['BITCOIN_TESTNET_ELECTRUM_URL']
        ?? 'electrum.blockstream.info';
      const port = Number(process.env['BITCOIN_ELECTRUM_PORT'] ?? '50001');
      wdk = wdk.registerWallet('bitcoin', WalletManagerBtc as any, {
        client: {
          type: 'electrum',
          clientConfig: { host, port },
        },
        network: isTestnetEnabled() ? 'testnet' : 'bitcoin',
      });
      const account = await wdk.getAccountByPath('bitcoin', "0'/0/0");
      return await account.getAddress();
    }

    const tonRpcUrl = process.env['TON_RPC_URL']
      ?? process.env['TON_TESTNET_RPC_URL']
      ?? 'https://toncenter.com/api/v2/jsonRPC';
    const tonApiUrl = process.env['TON_API_URL'] ?? 'https://tonapi.io/v3';
    wdk = wdk.registerWallet('ton', WalletManagerTon as any, {
      tonClient: { url: tonRpcUrl, secretKey: process.env['TON_RPC_API_KEY'] },
      tonApiClient: { url: tonApiUrl, secretKey: process.env['TON_API_KEY'] },
    });
    const account = await wdk.getAccountByPath('ton', "0'/0/0");
    return await account.getAddress();
  }

  private createSessionForCreator(creator: { id: string; username: string }, family: WalletFamily, address: string) {
    const sessionToken = randomHex(24);
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const session = this.sessionsRepo.create({
      creator_id: creator.id,
      family,
      address,
      token: sessionToken,
      expires_at: expiresAt,
    });

    return {
      creatorId: creator.id,
      username: creator.username,
      sessionToken: session.token,
      expiresAt: session.expires_at,
    };
  }

  async connectManagedWallet(input: ConnectManagedWalletInput) {
    const fallbackNetwork = getDefaultNetworkForFamily(input.family);
    const normalizedNetwork = normalizeChain(input.network) ?? fallbackNetwork;
    if (!isNetworkCompatibleWithFamily(input.family, normalizedNetwork)) {
      throw new Error(`Network ${normalizedNetwork} is not compatible with wallet family ${input.family}.`);
    }

    const seedPhrase = validateSeedPhrase(input.seedPhrase);
    let address = '';
    try {
      address = await this.deriveAddressFromSeed(seedPhrase, input.family, normalizedNetwork);
    } catch {
      throw new Error('Unable to derive wallet address from the provided seed phrase.');
    }

    let creator = input.creatorId ? this.creatorsRepo.findById(input.creatorId) : null;
    if (!creator && input.username) {
      creator = this.creatorsRepo.findByUsername(input.username);
    }
    if (!creator) {
      const existingAdmin = this.creatorAdminWalletsRepo.findByAddress(address);
      if (existingAdmin) {
        creator = this.creatorsRepo.findById(existingAdmin.creatorId);
      }
    }

    if (!creator) {
      if (!input.username) {
        throw new Error('username is required for first login.');
      }

      creator = this.creatorsRepo.create({
        telegram_id: `wdk:${input.family}:${address.toLowerCase()}`,
        username: input.username,
        payout_address: address,
        preferred_chain: normalizedNetwork,
      });
    }

    this.creatorsRepo.update(creator.id, {
      telegram_id: `wdk:${input.family}:${address.toLowerCase()}`,
      payout_address: address,
      preferred_chain: normalizedNetwork,
    });

    this.creatorAdminWalletsRepo.upsert({
      creatorId: creator.id,
      family: input.family,
      network: normalizedNetwork,
      address,
      auth_method: resolveAuthMethod(input.family),
      public_key: undefined,
    });

    return {
      ...this.createSessionForCreator({ id: creator.id, username: creator.username }, input.family, address),
      address,
      family: input.family,
      network: normalizedNetwork,
    };
  }

  getSession(token: string | undefined | null) {
    if (!token) return null;
    const session = this.sessionsRepo.findByToken(token);
    if (!session) return null;
    if (Date.parse(session.expires_at) < Date.now()) {
      this.sessionsRepo.revoke(token);
      return null;
    }
    return session;
  }

  logout(token: string): void {
    this.sessionsRepo.revoke(token);
  }
}

export const authService = new AuthService();
