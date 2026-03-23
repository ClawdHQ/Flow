import crypto from 'crypto';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { Verifier } from 'bip322-js';
import { Address as TonAddress } from '@ton/core';
import { sha256_sync, signVerify } from '@ton/crypto';
import { config } from '../config/index.js';
import { normalizeChain, type SupportedChain } from '../config/chains.js';
import { AuthChallengesRepository } from '../storage/repositories/auth-challenges.js';
import { AuthSessionsRepository } from '../storage/repositories/auth-sessions.js';
import { CreatorAdminWalletsRepository } from '../storage/repositories/creator-admin-wallets.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import type { AuthMethod, CreatorAdminWallet, WalletFamily } from '../types/flow.js';

interface CreateChallengeInput {
  family: WalletFamily;
  address: string;
  network: string;
  host: string;
}

interface VerifyChallengeInput {
  family: WalletFamily;
  address: string;
  network: string;
  signature?: string;
  username?: string;
  creatorId?: string;
  publicKey?: string;
  tonProof?: {
    timestamp: number;
    domain: { lengthBytes?: number; value: string };
    payload: string;
    signature: string;
  };
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

function toLittleEndianBytes(value: bigint, bytes: number): Buffer {
  const out = Buffer.alloc(bytes);
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

export function buildTonProofMessage(address: string, proof: NonNullable<VerifyChallengeInput['tonProof']>): Uint8Array {
  const parsed = TonAddress.parse(address);
  const wc = Buffer.alloc(4);
  wc.writeInt32BE(parsed.workChain, 0);
  const domain = Buffer.from(proof.domain.value, 'utf8');
  const domainLen = Buffer.alloc(4);
  domainLen.writeUInt32LE(proof.domain.lengthBytes ?? domain.length, 0);
  const timestamp = toLittleEndianBytes(BigInt(proof.timestamp), 8);
  const payload = Buffer.from(proof.payload, 'utf8');
  const message = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    wc,
    parsed.hash,
    domainLen,
    domain,
    timestamp,
    payload,
  ]);
  const messageHash = sha256_sync(message);
  return sha256_sync(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect', 'utf8'), Buffer.from(messageHash)]));
}

export class AuthService {
  private readonly challengesRepo = new AuthChallengesRepository();
  private readonly sessionsRepo = new AuthSessionsRepository();
  private readonly creatorsRepo = new CreatorsRepository();
  private readonly creatorAdminWalletsRepo = new CreatorAdminWalletsRepository();

  createChallenge(input: CreateChallengeInput) {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + config.AUTH_CHALLENGE_TTL_SECONDS * 1000);
    const nonce = randomHex(8);
    const uri = config.FLOW_PUBLIC_BASE_URL;
    const statement = 'Sign in to Flow creator portal';
    const challenge = [
      `${input.host} wants you to sign in to Flow`,
      `${input.address}`,
      '',
      statement,
      '',
      `URI: ${uri}`,
      `Version: 1`,
      `Chain: ${input.network}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join('\n');

    return this.challengesRepo.create({
      family: input.family,
      address: input.address,
      network: input.network,
      challenge,
      nonce,
      host: input.host,
      payload_json: undefined,
      expires_at: expiresAt.toISOString(),
    });
  }

  private ensureCreator(input: VerifyChallengeInput): { id: string; username: string } {
    if (input.creatorId) {
      const existing = this.creatorsRepo.findById(input.creatorId);
      if (!existing) {
        throw new Error('Unknown creator.');
      }
      return { id: existing.id, username: existing.username };
    }

    if (input.username) {
      const existing = this.creatorsRepo.findByUsername(input.username);
      if (existing) {
        return { id: existing.id, username: existing.username };
      }

      const normalizedChain = normalizeChain(input.network) ?? ('polygon' as SupportedChain);
      const created = this.creatorsRepo.create({
        telegram_id: `wallet:${input.family}:${input.address.toLowerCase()}`,
        username: input.username,
        payout_address: input.address,
        preferred_chain: normalizedChain,
      });
      return { id: created.id, username: created.username };
    }

    const existingAdmin = this.creatorAdminWalletsRepo.findByAddress(input.address);
    if (existingAdmin) {
      return { id: existingAdmin.creatorId, username: this.creatorsRepo.findById(existingAdmin.creatorId)?.username ?? existingAdmin.address };
    }

    throw new Error('username or creatorId is required for first login.');
  }

  private verifyEvm(message: string, address: string, signature?: string): boolean {
    if (!signature) return false;
    return ethers.verifyMessage(message, signature).toLowerCase() === address.toLowerCase();
  }

  private verifyTron(message: string, address: string, signature?: string): boolean {
    if (!signature) return false;
    const recovered = TronWeb.utils.message.verifyMessage(message, signature, address);
    return typeof recovered === 'string' ? recovered === address : Boolean(recovered);
  }

  private verifyBtc(message: string, address: string, signature?: string): boolean {
    if (!signature) return false;
    return Verifier.verifySignature(address, message, signature);
  }

  private verifyTon(address: string, publicKey: string | undefined, proof: VerifyChallengeInput['tonProof']): boolean {
    if (!publicKey || !proof) return false;
    const message = buildTonProofMessage(address, proof);
    const signature = Buffer.from(proof.signature, 'base64');
    const key = Buffer.from(publicKey, 'hex');
    return signVerify(Buffer.from(message), signature, key);
  }

  verifyChallenge(input: VerifyChallengeInput) {
    const challenge = this.challengesRepo.findActive(input.family, input.address);
    if (!challenge) {
      throw new Error('No active challenge found.');
    }
    if (Date.parse(challenge.expires_at) < Date.now()) {
      throw new Error('Challenge expired.');
    }

    const message = challenge.challenge;
    const verified =
      (input.family === 'evm' || input.family === 'evm_erc4337') ? this.verifyEvm(message, input.address, input.signature)
      : input.family === 'tron_gasfree' ? this.verifyTron(message, input.address, input.signature)
      : input.family === 'btc' ? this.verifyBtc(message, input.address, input.signature)
      : this.verifyTon(input.address, input.publicKey, input.tonProof);

    if ((input.family === 'ton' || input.family === 'ton_gasless') && input.tonProof?.payload !== challenge.nonce) {
      throw new Error('TON proof payload must match the issued challenge nonce.');
    }

    if (!verified) {
      throw new Error('Signature verification failed.');
    }

    const creator = this.ensureCreator(input);
    const sessionToken = randomHex(24);
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    this.creatorAdminWalletsRepo.upsert({
      creatorId: creator.id,
      family: input.family,
      network: input.network,
      address: input.address,
      auth_method: resolveAuthMethod(input.family),
      public_key: input.publicKey,
    });
    this.challengesRepo.consume(challenge.id);

    const session = this.sessionsRepo.create({
      creator_id: creator.id,
      family: input.family,
      address: input.address,
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
