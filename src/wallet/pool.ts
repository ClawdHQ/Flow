import { walletManager } from './index.js';
import { logger } from '../utils/logger.js';

export class PoolWalletManager {
  async getAddress(): Promise<string> {
    const info = await walletManager.getPoolWallet();
    return info.address;
  }

  async getBalance(): Promise<bigint> {
    const info = await walletManager.getPoolWallet();
    return walletManager.getBalance(info.address, info.chain);
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
    const info = await walletManager.getPoolWallet();
    return walletManager.signMessage(info.hdPath, data);
  }
}
