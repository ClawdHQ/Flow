import { walletManager } from '../src/wallet/index.js';
import { getChainDisplayName } from '../src/config/chains.js';
import { logger } from '../src/utils/logger.js';

async function seedPool(): Promise<void> {
  const poolInfo = await walletManager.getPoolWallet();
  logger.info({ address: poolInfo.address }, 'Pool wallet address for seeding');
  console.log(`\nPool Wallet Address: ${poolInfo.address}`);
  console.log(`Chain: ${getChainDisplayName(poolInfo.chain)}`);
  console.log(`\nTo seed the pool, send USD₮ to the above address on ${getChainDisplayName(poolInfo.chain)}.`);
  console.log('\nSimulating: Pool seeded with 1000 USD₮ (test mode)');
}

seedPool().catch(console.error);
