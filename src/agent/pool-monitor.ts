import cron from 'node-cron';
import { PoolWalletManager } from '../wallet/pool.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { logger } from '../utils/logger.js';
import { baseUnitsToUsdt } from '../utils/math.js';

export interface PoolReport {
  balance: bigint;
  multiplier: number;
  projectedPoolUsage: bigint;
  roundsUntilDepletion: number;
  totalDistributedAllTime: bigint;
}

const poolWallet = new PoolWalletManager();
const roundsRepo = new RoundsRepository();

export class PoolMonitor {
  private task: cron.ScheduledTask | null = null;
  private currentMultiplier = 1.0;

  start(): void {
    this.task = cron.schedule('*/30 * * * *', async () => {
      try {
        await this.checkPoolHealth();
      } catch (err) {
        logger.error({ err }, 'Pool health check failed');
      }
    });
    logger.info('Pool monitor started');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }

  async checkPoolHealth(): Promise<void> {
    const balance = await poolWallet.getBalance();
    const minimum = BigInt(Math.round((parseFloat(process.env['MATCHING_POOL_MINIMUM'] ?? '500')) * 1_000_000));
    const boost = BigInt(Math.round((parseFloat(process.env['MATCHING_POOL_BOOST_THRESHOLD'] ?? '5000')) * 1_000_000));

    if (balance < minimum) {
      this.currentMultiplier = 0.5;
      logger.warn({ balance: baseUnitsToUsdt(balance) }, 'Pool below minimum — multiplier 0.5x');
    } else if (balance > boost) {
      this.currentMultiplier = 2.0;
      logger.info({ balance: baseUnitsToUsdt(balance) }, 'Pool boosted — multiplier 2.0x');
    } else {
      this.currentMultiplier = 1.0;
    }

    // Persist multiplier to current round
    const round = roundsRepo.findCurrent();
    if (round) {
      roundsRepo.update(round.id, { matching_multiplier: this.currentMultiplier });
    }
  }

  async getMultiplier(): Promise<number> {
    return this.currentMultiplier;
  }

  async generatePoolReport(): Promise<PoolReport> {
    const balance = await poolWallet.getBalance();
    const rounds = roundsRepo.findAll(10);
    const avgUsage = rounds.length > 0
      ? rounds.reduce((s, r) => s + BigInt(r.pool_used), 0n) / BigInt(rounds.length)
      : 0n;
    const roundsUntilDepletion = avgUsage > 0n ? Number(balance / avgUsage) : 999;
    const totalDistributed = rounds.reduce((s, r) => s + BigInt(r.total_matched), 0n);

    return {
      balance,
      multiplier: this.currentMultiplier,
      projectedPoolUsage: avgUsage,
      roundsUntilDepletion,
      totalDistributedAllTime: totalDistributed,
    };
  }

  async collectProtocolFees(): Promise<void> {
    logger.info('Protocol fee collection triggered');
  }
}
