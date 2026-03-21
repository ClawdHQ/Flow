import { walletManager } from '../src/wallet/index.js';
import { logger } from '../src/utils/logger.js';
import { baseUnitsToUsdt } from '../src/utils/math.js';

async function seedPool(): Promise<void> {
  const poolInfo = await walletManager.getPoolWallet();
  logger.info({ address: poolInfo.address }, 'Pool wallet address for seeding');
  console.log(`\nPool Wallet Address: ${poolInfo.address}`);
  console.log(`Chain: ${poolInfo.chain}`);
  console.log(`\nTo seed the pool, send USDT to the above address on ${poolInfo.chain}.`);
  console.log('\nSimulating: Pool seeded with 1000 USDT (test mode)');
}

seedPool().catch(console.error);
