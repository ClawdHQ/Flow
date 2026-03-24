import { walletManager } from './index.js';
import { getPoolHomeChain, SupportedChain } from '../config/chains.js';
import type { SupportedToken } from '../tokens/index.js';
import type { PayoutDestination } from '../types/flow.js';
import { logger } from '../utils/logger.js';

export class PoolWalletManager {
  constructor(private readonly chain: SupportedChain = getPoolHomeChain()) {}

  async getAddress(): Promise<string> {
    const info = await walletManager.getPoolWallet(this.chain);
    return info.address;
  }

  async getBalance(): Promise<bigint> {
    const info = await walletManager.getPoolWallet(this.chain);
    return walletManager.getBalance(info.address, info.chain, info.hdPath);
  }
 
  async getProtocolBalance(): Promise<bigint> {
    const info = await walletManager.createEscrowWallet(999999, this.chain);
    return walletManager.getBalance(info.address, info.chain, info.hdPath);
  }

  async transferUSDT(to: string, amount: bigint): Promise<string> {
    return this.transferToken(to, amount, 'USDT');
  }

  async transferToken(to: string, amount: bigint, token: SupportedToken): Promise<string> {
    const info = await walletManager.getPoolWallet(this.chain);
    const result = await walletManager.sendToken(info.hdPath, to, amount, token, info.chain);
    if (!result.success) throw new Error(result.error ?? 'Pool transfer failed');
    logger.info({ chain: this.chain, token, to, txHash: result.txHash, mode: result.mode }, 'Pool transfer executed');
    return result.txHash;
  }

  async settlePayout(destination: Pick<PayoutDestination, 'address' | 'network' | 'token'>, amount: bigint): Promise<{
    txHash: string;
    approveHash?: string;
    resetAllowanceHash?: string;
    mode: 'direct' | 'bridge' | 'demo';
  }> {
    const poolInfo = await walletManager.getPoolWallet(this.chain);
    if (destination.network === poolInfo.chain) {
      const result = await walletManager.sendToken(poolInfo.hdPath, destination.address, amount, destination.token as SupportedToken, poolInfo.chain);
      if (!result.success) throw new Error(result.error ?? 'Pool payout failed');
      return {
        txHash: result.txHash,
        mode: result.mode ?? 'direct',
      };
    }

    const bridgeResult = await walletManager.bridgeUsdt0(destination.network as SupportedChain, amount, destination.address);
    if (!bridgeResult.success) {
      throw new Error(bridgeResult.error ?? 'Bridge payout failed');
    }
    return {
      txHash: bridgeResult.txHash,
      approveHash: bridgeResult.approveHash,
      resetAllowanceHash: bridgeResult.resetAllowanceHash,
      mode: bridgeResult.mode ?? 'bridge',
    };
  }

  async buildTransaction(to: string, amount: bigint, meta: Record<string, unknown> = {}): Promise<{ unsignedTx: string; txHash: string }> {
    return walletManager.buildPoolTransaction(to, amount, meta);
  }

  async executeTransaction(unsignedTx: string, agentSignature: string): Promise<string> {
    const result = await walletManager.executePoolTransaction(unsignedTx, agentSignature);
    if (!result.success) throw new Error(result.error ?? 'Pool transaction failed');
    logger.info({ txHash: result.txHash }, 'Pool transaction executed');
    return result.txHash;
  }

  async signData(data: string): Promise<string> {
    const info = await walletManager.getPoolWallet(this.chain);
    return walletManager.signMessage(info.hdPath, data, info.chain);
  }

  async verifySignature(data: string, signature: string): Promise<boolean> {
    return walletManager.verifyPoolSignature(data, signature);
  }
}
