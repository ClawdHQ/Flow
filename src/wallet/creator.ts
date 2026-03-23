import { walletManager, WalletInfo } from './index.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { getHdPathPrefix } from '../config/chains.js';
import type { SupportedToken } from '../tokens/index.js';
import { isValidWalletAddress, resolveSupportedChain } from './addresses.js';
import { PayoutDestinationsRepository } from '../storage/repositories/payout-destinations.js';
import { getWalletFamilyForChain } from '../config/chains.js';
import type { PayoutDestination } from '../types/flow.js';

const creatorsRepo = new CreatorsRepository();
const payoutDestinationsRepo = new PayoutDestinationsRepository();

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

  async getPayoutDestination(creatorId: string): Promise<PayoutDestination> {
    const creator = creatorsRepo.findById(creatorId);
    if (!creator) throw new Error(`Creator not found: ${creatorId}`);

    const stored = payoutDestinationsRepo.findByCreatorId(creatorId);
    if (stored) {
      return {
        creatorId,
        family: stored.family,
        network: stored.network,
        token: stored.token,
        address: stored.address,
        id: stored.id,
        created_at: stored.created_at,
        updated_at: stored.updated_at,
      };
    }

    const chain = resolveSupportedChain(creator.preferred_chain);
    return payoutDestinationsRepo.upsert({
      creatorId,
      family: getWalletFamilyForChain(chain),
      network: chain,
      token: 'USDT',
      address: creator.payout_address,
    });
  }

  async updatePayoutDestination(creatorId: string, destination: Omit<PayoutDestination, 'creatorId'>): Promise<PayoutDestination> {
    return payoutDestinationsRepo.upsert({
      creatorId,
      family: destination.family,
      network: destination.network,
      token: destination.token,
      address: destination.address,
    });
  }

  async getBalance(creatorId: string): Promise<bigint> {
    const wallet = await this.getOrCreateWallet(creatorId);
    return walletManager.getBalance(wallet.address, wallet.chain, wallet.hdPath);
  }

  async withdraw(creatorId: string, toAddress: string, amount: bigint): Promise<string> {
    return this.withdrawToken(creatorId, toAddress, amount, 'USDT');
  }

  async withdrawToken(creatorId: string, toAddress: string, amount: bigint, token: SupportedToken): Promise<string> {
    const wallet = await this.getOrCreateWallet(creatorId);
    const result = await walletManager.sendToken(wallet.hdPath, toAddress, amount, token, wallet.chain);
    if (!result.success) throw new Error(result.error ?? 'Withdrawal failed');
    return result.txHash;
  }
}
