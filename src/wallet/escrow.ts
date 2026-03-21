import { walletManager } from './index.js';
import { logger } from '../utils/logger.js';

export interface EscrowRecord {
  tipId: string;
  address: string;
  chain: string;
  expectedAmount: bigint;
  status: 'pending' | 'confirmed' | 'settled' | 'refunded';
}

interface EscrowInternalRecord extends EscrowRecord {
  hdPath: string;
}

const escrowStore = new Map<string, EscrowInternalRecord>();
let escrowIndex = 0;

export class EscrowWalletManager {
  async createForTip(tipId: string, amountUsdt: bigint, chain: string): Promise<EscrowRecord> {
    const walletInfo = await walletManager.createEscrowWallet(escrowIndex++);
    const record: EscrowInternalRecord = {
      tipId,
      address: walletInfo.address,
      hdPath: walletInfo.hdPath,
      chain,
      expectedAmount: amountUsdt,
      status: 'pending',
    };
    escrowStore.set(tipId, record);
    return record;
  }

  async confirmDeposit(tipId: string): Promise<boolean> {
    const record = escrowStore.get(tipId);
    if (!record) return false;
    const timeout = 5 * 60 * 1000;
    const interval = 30 * 1000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const balance = await walletManager.getBalance(record.address, record.chain);
      if (balance >= record.expectedAmount) {
        record.status = 'confirmed';
        return true;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    logger.warn({ tipId }, 'Escrow deposit confirmation timed out');
    return false;
  }

  async consolidateAtRoundEnd(tipId: string, creatorAddress: string): Promise<string> {
    const record = escrowStore.get(tipId);
    if (!record) throw new Error(`Escrow record not found for tip ${tipId}`);
    const result = await walletManager.sendUSDT(
      record.hdPath, creatorAddress, record.expectedAmount, record.chain
    );
    record.status = 'settled';
    return result.txHash;
  }

  async refundEscrow(tipId: string): Promise<string> {
    const record = escrowStore.get(tipId);
    if (!record) throw new Error(`Escrow record not found for tip ${tipId}`);
    record.status = 'refunded';
    return '0x' + '0'.repeat(64);
  }
}
