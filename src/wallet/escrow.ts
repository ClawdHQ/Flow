import type { WalletManager } from './index.js';
import { walletManager } from './index.js';
import type { SupportedChain } from '../config/chains.js';
import { resolveSupportedChain } from './addresses.js';
import { EscrowDbRecord, EscrowsRepository, EscrowStatus } from '../storage/repositories/escrows.js';
import { logger } from '../utils/logger.js';

export interface EscrowRecord {
  tipId: string;
  address: string;
  chain: SupportedChain;
  hdPath: string;
  derivationIndex: number;
  expectedAmount: bigint;
  status: EscrowStatus;
  chatId?: string;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
  settledAt?: string;
  refundedAt?: string;
}

interface EscrowWalletDependencies {
  wallet?: Pick<WalletManager, 'createEscrowWallet' | 'getBalance' | 'sendUSDT'>;
  escrowsRepo?: EscrowsRepository;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  confirmationTimeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 30 * 1000;
const confirmationJobs = new Map<string, Promise<boolean>>();

function toEscrowRecord(record: EscrowDbRecord): EscrowRecord {
  return {
    tipId: record.tip_id,
    address: record.address,
    chain: resolveSupportedChain(record.chain),
    hdPath: record.hd_path,
    derivationIndex: record.derivation_index,
    expectedAmount: BigInt(record.expected_amount),
    status: record.status,
    chatId: record.chat_id,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    confirmedAt: record.confirmed_at,
    settledAt: record.settled_at,
    refundedAt: record.refunded_at,
  };
}

export class EscrowWalletManager {
  private readonly wallet: Pick<WalletManager, 'createEscrowWallet' | 'getBalance' | 'sendUSDT'>;
  private readonly escrowsRepo: EscrowsRepository;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly confirmationTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(dependencies: EscrowWalletDependencies = {}) {
    this.wallet = dependencies.wallet ?? walletManager;
    this.escrowsRepo = dependencies.escrowsRepo ?? new EscrowsRepository();
    this.clock = dependencies.clock ?? Date.now;
    this.sleep = dependencies.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.confirmationTimeoutMs = dependencies.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
    this.pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  findByTipId(tipId: string): EscrowRecord | null {
    const record = this.escrowsRepo.findByTipId(tipId);
    return record ? toEscrowRecord(record) : null;
  }

  findPending(): EscrowRecord[] {
    return this.escrowsRepo.findPending().map(toEscrowRecord);
  }

  async createForTip(
    tipId: string,
    amountUsdt: bigint,
    chain: string,
    options: { chatId?: string } = {},
  ): Promise<EscrowRecord> {
    const existingRecord = this.escrowsRepo.findByTipId(tipId);
    if (existingRecord) {
      if (options.chatId && options.chatId !== existingRecord.chat_id) {
        this.escrowsRepo.update(tipId, { chat_id: options.chatId });
        return toEscrowRecord({ ...existingRecord, chat_id: options.chatId });
      }
      return toEscrowRecord(existingRecord);
    }

    const normalizedChain = resolveSupportedChain(chain);
    const derivationIndex = this.escrowsRepo.getNextDerivationIndex();
    const walletInfo = await this.wallet.createEscrowWallet(derivationIndex, normalizedChain);
    const expiresAt = new Date(this.clock() + this.confirmationTimeoutMs).toISOString();
    const record = this.escrowsRepo.create({
      tip_id: tipId,
      derivation_index: derivationIndex,
      address: walletInfo.address,
      chain: normalizedChain,
      hd_path: walletInfo.hdPath,
      expected_amount: amountUsdt.toString(),
      status: 'pending',
      chat_id: options.chatId,
      expires_at: expiresAt,
    });
    return toEscrowRecord(record);
  }

  async confirmDeposit(tipId: string): Promise<boolean> {
    const existingJob = confirmationJobs.get(tipId);
    if (existingJob) {
      return existingJob;
    }

    const job = this.confirmDepositInternal(tipId)
      .finally(() => confirmationJobs.delete(tipId));
    confirmationJobs.set(tipId, job);
    return job;
  }

  async consolidateAtRoundEnd(tipId: string, creatorAddress: string): Promise<string> {
    const record = this.findByTipId(tipId);
    if (!record) throw new Error(`Escrow record not found for tip ${tipId}`);
    const result = await this.wallet.sendUSDT(
      record.hdPath, creatorAddress, record.expectedAmount, record.chain
    );
    this.escrowsRepo.update(tipId, {
      status: 'settled',
      settled_at: new Date(this.clock()).toISOString(),
    });
    return result.txHash;
  }

  async refundEscrow(tipId: string): Promise<string> {
    const record = this.findByTipId(tipId);
    if (!record) throw new Error(`Escrow record not found for tip ${tipId}`);
    this.escrowsRepo.update(tipId, {
      status: 'refunded',
      refunded_at: new Date(this.clock()).toISOString(),
    });
    return '0x' + '0'.repeat(64);
  }

  private async confirmDepositInternal(tipId: string): Promise<boolean> {
    let record = this.findByTipId(tipId);
    if (!record) {
      logger.warn({ tipId }, 'Escrow deposit confirmation requested without an escrow record');
      return false;
    }

    if (record.status === 'confirmed' || record.status === 'settled') {
      return true;
    }
    if (record.status === 'expired' || record.status === 'refunded') {
      return false;
    }

    let expiresAtMs = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      expiresAtMs = this.clock() + this.confirmationTimeoutMs;
      this.escrowsRepo.update(tipId, { expires_at: new Date(expiresAtMs).toISOString() });
    }

    while (this.clock() < expiresAtMs) {
      const balance = await this.wallet.getBalance(record.address, record.chain, record.hdPath);
      if (balance >= record.expectedAmount) {
        this.escrowsRepo.update(tipId, {
          status: 'confirmed',
          confirmed_at: new Date(this.clock()).toISOString(),
        });
        return true;
      }

      const remainingMs = expiresAtMs - this.clock();
      if (remainingMs <= 0) {
        break;
      }

      await this.sleep(Math.min(this.pollIntervalMs, remainingMs));
      record = this.findByTipId(tipId);
      if (!record) {
        logger.warn({ tipId }, 'Escrow record disappeared during deposit confirmation');
        return false;
      }
      if (record.status === 'confirmed' || record.status === 'settled') {
        return true;
      }
      if (record.status === 'expired' || record.status === 'refunded') {
        return false;
      }
    }

    this.escrowsRepo.update(tipId, { status: 'expired' });
    logger.warn({ tipId }, 'Escrow deposit confirmation timed out');
    return false;
  }
}
