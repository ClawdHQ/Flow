import crypto from 'crypto';
import { config } from '../config/index.js';
import { getChainConfig, normalizeChain, type SupportedChain } from '../config/chains.js';
import { AuthSessionsRepository } from '../storage/repositories/auth-sessions.js';
import { CreatorAdminWalletsRepository } from '../storage/repositories/creator-admin-wallets.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { isSupabaseConfigured, sbFindOne, sbInsert, sbUpdate, sbUpsert } from '../storage/supabase.js';
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

  async generateSeedPhrase(): Promise<string> {
    const { default: WDK } = await import('@tetherto/wdk');
    return WDK.getRandomSeedPhrase();
  }

  private async deriveAddressFromSeed(seedPhrase: string, family: WalletFamily, network: SupportedChain): Promise<string> {
    const { default: WDK } = await import('@tetherto/wdk');
    let wdk = new WDK(seedPhrase);

    if (family === 'evm' || family === 'evm_erc4337') {
      const { default: WalletManagerEvm } = await import('@tetherto/wdk-wallet-evm');
      const rpc = getChainConfig(network).rpcUrl || getEvmFallbackRpc(network);
      wdk = wdk.registerWallet(network, WalletManagerEvm, { provider: rpc });
      const account = await wdk.getAccountByPath(network, "0'/0/0");
      return await account.getAddress();
    }

    if (family === 'tron_gasfree') {
      const { default: WalletManagerTron } = await import('@tetherto/wdk-wallet-tron');
      const rpc = getChainConfig('tron').rpcUrl || 'https://api.trongrid.io';
      wdk = wdk.registerWallet('tron', WalletManagerTron, { provider: rpc });
      const account = await wdk.getAccountByPath('tron', "0'/0/0");
      return await account.getAddress();
    }

    if (family === 'btc') {
      throw new Error('Bitcoin auth is currently unavailable in web runtime.');
    }

    throw new Error(`${family} auth is temporarily disabled in production runtime.`);
  }

  private async createSessionForCreator(creator: { id: string; username: string }, family: WalletFamily, address: string) {
    const sessionToken = randomHex(24);
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const session = await sbInsert<any>('auth_sessions', {
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
    } catch (err) {
      if (err instanceof Error && err.message.includes('disabled in production runtime')) {
        throw err;
      }
      throw new Error('Unable to derive wallet address from the provided seed phrase.');
    }

    let creator: any = null;
    if (isSupabaseConfigured()) {
      if (input.creatorId) creator = await sbFindOne('creators', { id: input.creatorId });
      if (!creator && input.username) creator = await sbFindOne('creators', { username: input.username });
      if (!creator) {
        const admin = await sbFindOne<any>('creator_admin_wallets', { address: address });
        if (admin) creator = await sbFindOne('creators', { id: admin.creator_id });
      }
    } else {
      creator = input.creatorId ? this.creatorsRepo.findById(input.creatorId) : null;
      if (!creator && input.username) {
        creator = this.creatorsRepo.findByUsername(input.username);
      }
      if (!creator) {
        const existingAdmin = this.creatorAdminWalletsRepo.findByAddress(address);
        if (existingAdmin) {
          creator = this.creatorsRepo.findById(existingAdmin.creatorId);
        }
      }
    }

    if (!creator) {
      if (!input.username) {
        throw new Error('username is required for first login.');
      }

      const newCreator = {
        telegram_id: `wdk:${input.family}:${address.toLowerCase()}`,
        username: input.username,
        payout_address: address,
        preferred_chain: normalizedNetwork,
      };

      if (isSupabaseConfigured()) {
        creator = await sbInsert<any>('creators', newCreator);
      } else {
        creator = this.creatorsRepo.create(newCreator);
      }
    } else {
      const updates = {
        telegram_id: `wdk:${input.family}:${address.toLowerCase()}`,
        payout_address: address,
        preferred_chain: normalizedNetwork,
      };

      if (isSupabaseConfigured()) {
        await sbUpdate('creators', { id: creator.id }, updates);
      } else {
        this.creatorsRepo.update(creator.id, updates);
      }
    }

    const adminWallet = {
      creator_id: creator.id,
      family: input.family,
      network: normalizedNetwork,
      address,
      auth_method: resolveAuthMethod(input.family),
    };

    if (isSupabaseConfigured()) {
      await sbUpsert('creator_admin_wallets', adminWallet, ['creator_id', 'family', 'network', 'address']);
    } else {
      this.creatorAdminWalletsRepo.upsert({
        creatorId: creator.id,
        family: input.family,
        network: normalizedNetwork,
        address,
        auth_method: resolveAuthMethod(input.family),
        public_key: undefined,
      });
    }

    const session = await this.createSessionForCreator({ id: creator.id, username: creator.username }, input.family, address);
    return {
      ...session,
      address,
      family: input.family,
      network: normalizedNetwork,
    };
  }

  async getSession(token: string | undefined | null) {
    if (!token) return null;
    let session: any = null;

    if (isSupabaseConfigured()) {
      session = await sbFindOne('auth_sessions', { token });
    } else {
      session = this.sessionsRepo.findByToken(token);
    }

    if (!session) return null;
    if (Date.parse(session.expires_at) < Date.now()) {
      if (isSupabaseConfigured()) {
        const { sbDelete } = await import('../storage/supabase.js');
        await sbDelete('auth_sessions', { token });
      } else {
        this.sessionsRepo.revoke(token);
      }
      return null;
    }
    return session;
  }

  async logout(token: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { sbDelete } = await import('../storage/supabase.js');
      await sbDelete('auth_sessions', { token });
    } else {
      this.sessionsRepo.revoke(token);
    }
  }
}

export const authService = new AuthService();
