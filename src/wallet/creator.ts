import { walletManager, WalletInfo } from './index.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';

const creatorsRepo = new CreatorsRepository();

export class CreatorWalletManager {
  async getOrCreateWallet(creatorId: string): Promise<WalletInfo> {
    const creator = creatorsRepo.findById(creatorId);
    if (!creator) throw new Error(`Creator not found: ${creatorId}`);
    if (creator.accumulation_wallet_address) {
      return {
        address: creator.accumulation_wallet_address,
        hdPath: creator.accumulation_wallet_path ?? '',
        chain: creator.preferred_chain,
      };
    }
    const index = creatorsRepo.count();
    const walletInfo = await walletManager.getCreatorWallet(index);
    creatorsRepo.update(creatorId, {
      accumulation_wallet_address: walletInfo.address,
      accumulation_wallet_path: walletInfo.hdPath,
    });
    return walletInfo;
  }

  async getBalance(creatorId: string): Promise<bigint> {
    const wallet = await this.getOrCreateWallet(creatorId);
    return walletManager.getBalance(wallet.address, wallet.chain);
  }

  async withdraw(creatorId: string, toAddress: string, amount: bigint): Promise<string> {
    const wallet = await this.getOrCreateWallet(creatorId);
    const result = await walletManager.sendUSDT(wallet.hdPath, toAddress, amount, wallet.chain);
    if (!result.success) throw new Error(result.error ?? 'Withdrawal failed');
    return result.txHash;
  }
}
