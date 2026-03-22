import { walletManager } from './index.js';
import { getDefaultChain, SupportedChain } from '../config/chains.js';
import type { SupportedToken } from '../tokens/index.js';
import { logger } from '../utils/logger.js';

export class PoolWalletManager {
  constructor(private readonly chain: SupportedChain = getDefaultChain()) {}

  async getAddress(): Promise<string> {
    const info = await walletManager.getPoolWallet(this.chain);
    return info.address;
  }

  async getBalance(): Promise<bigint> {
    const info = await walletManager.getPoolWallet(this.chain);
    return walletManager.getBalance(info.address, info.chain, info.hdPath);
  }

  async transferUSDT(to: string, amount: bigint): Promise<string> {
    return this.transferToken(to, amount, 'USDT');
  }

  async transferToken(to: string, amount: bigint, token: SupportedToken): Promise<string> {
    const info = await walletManager.getPoolWallet(this.chain);
    const result = await walletManager.sendToken(info.hdPath, to, amount, token, info.chain);
    if (!result.success) throw new Error(result.error ?? 'Pool transfer failed');
    logger.info({ chain: this.chain, token, to, txHash: result.txHash }, 'Pool transfer executed');
    return result.txHash;
  }

  async buildTransaction(to: string, amount: bigint): Promise<{ unsignedTx: string; txHash: string }> {
    return walletManager.buildPoolTransaction(to, amount);
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
}
