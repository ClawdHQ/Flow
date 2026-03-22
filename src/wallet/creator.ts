import { walletManager, WalletInfo } from './index.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { getHdPathPrefix } from '../config/chains.js';
import { isValidWalletAddress, resolveSupportedChain } from './addresses.js';

const creatorsRepo = new CreatorsRepository();

export class CreatorWalletManager {
  async getOrCreateWallet(creatorId: string): Promise<WalletInfo> {
    const creator = creatorsRepo.findById(creatorId);
    if (!creator) throw new Error(`Creator not found: ${creatorId}`);
    const chain = resolveSupportedChain(creator.preferred_chain);
    const storedPath = creator.accumulation_wallet_path ?? '';
    const expectedPrefix = `${getHdPathPrefix(chain)}/`;

    if (
      creator.accumulation_wallet_address &&
      storedPath.startsWith(expectedPrefix) &&
      isValidWalletAddress(creator.accumulation_wallet_address, chain)
    ) {
      return {
        address: creator.accumulation_wallet_address,
        hdPath: storedPath,
        chain,
      };
    }

    const index = creatorsRepo.getIndexById(creatorId);
    const walletInfo = await walletManager.getCreatorWallet(index, chain);
    creatorsRepo.update(creatorId, {
      accumulation_wallet_address: walletInfo.address,
      accumulation_wallet_path: walletInfo.hdPath,
    });
    return walletInfo;
  }

  async getBalance(creatorId: string): Promise<bigint> {
    const wallet = await this.getOrCreateWallet(creatorId);
    return walletManager.getBalance(wallet.address, wallet.chain, wallet.hdPath);
  }

  async withdraw(creatorId: string, toAddress: string, amount: bigint): Promise<string> {
    const wallet = await this.getOrCreateWallet(creatorId);
    const result = await walletManager.sendUSDT(wallet.hdPath, toAddress, amount, wallet.chain);
    if (!result.success) throw new Error(result.error ?? 'Withdrawal failed');
    return result.txHash;
  }
}
