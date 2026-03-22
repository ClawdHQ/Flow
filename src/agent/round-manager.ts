import cron from 'node-cron';
import crypto from 'crypto';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { SybilDetector } from './sybil.js';
import { computeRoundAllocations, AllocationPlan } from '../quadratic/allocator.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { EscrowWalletManager } from '../wallet/escrow.js';
import { publishRoundReport } from '../ipfs/publisher.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { logger } from '../utils/logger.js';
import { ROUND_REVIEW_PROMPT } from './prompts.js';
import { llmClient, getModelName } from '../utils/llm-client.js';

const roundsRepo = new RoundsRepository();
const sybilDetector = new SybilDetector();
const poolWallet = new PoolWalletManager();
const tipsRepo = new TipsRepository();
const escrowWallet = new EscrowWalletManager();

export class RoundManager {
  private task: cron.ScheduledTask | null = null;

  constructor() {
    // llmClient is initialized at module load in utils/llm-client.ts
  }

  start(): void {
    const cronExpr = process.env['ROUND_CRON'] ?? '0 0 * * *';
    this.task = cron.schedule(cronExpr, async () => {
      try {
        const current = roundsRepo.findCurrent();
        if (current) await this.executeRound(current.id);
      } catch (err) {
        logger.error({ err }, 'Round execution failed');
      }
    });
    logger.info('Round manager started');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }

  async executeRound(roundId: string): Promise<void> {
    logger.info({ roundId }, 'Executing round lifecycle');
    try {
      await this.lockRound(roundId);
      await this.analyzeRound(roundId);
      const plan = await this.reviewAndSignAllocationPlan(roundId);
      await this.executeAllocations(plan);
      await this.archiveRound(roundId, plan);
      await this.resetRound();
    } catch (err) {
      logger.error({ err, roundId }, 'Round execution failed');
      roundsRepo.updateStatus(roundId, 'failed');
      throw err;
    }
  }

  async recoverRound(roundId: string): Promise<void> {
    const round = roundsRepo.findById(roundId);
    if (!round) throw new Error(`Round not found: ${roundId}`);
    logger.info({ roundId, status: round.status }, 'Recovering round');
    await this.executeRound(roundId);
  }

  private async lockRound(roundId: string): Promise<void> {
    roundsRepo.updateStatus(roundId, 'locking');
    logger.info({ roundId }, 'Phase 1: Locking round');
  }

  private async analyzeRound(roundId: string): Promise<void> {
    roundsRepo.updateStatus(roundId, 'analyzing');
    logger.info({ roundId }, 'Phase 2: Analyzing round');
    await sybilDetector.batchAnalyzeRound(roundId);
  }

  private async reviewAndSignAllocationPlan(roundId: string): Promise<AllocationPlan> {
    const plan = await computeRoundAllocations(roundId);

    const planData = JSON.stringify({
      ...plan,
      allocations: plan.allocations.map(a => ({
        ...a,
        directTips: a.directTips.toString(),
        matchAmount: a.matchAmount.toString(),
        score: a.score.toString(),
      })),
      poolBreakdown: plan.poolBreakdown.map(pool => ({
        ...pool,
        balance: pool.balance.toString(),
      })),
      totalPool: plan.totalPool.toString(),
      totalMatched: plan.totalMatched.toString(),
    });

    roundsRepo.updateStatus(roundId, 'reviewing');
    logger.info({ roundId }, 'Phase 3: Reviewing allocation plan');
    if (llmClient) {
      try {
        const response = await llmClient.messages.create({
          model: getModelName(),
          max_tokens: 512,
          system: ROUND_REVIEW_PROMPT,
          messages: [{ role: 'user', content: planData }],
        });
        const content = response.content[0];
        if (content && content.type === 'text') {
          const review = JSON.parse(content.text) as { proceed: boolean; concerns: string[] };
          if (!review.proceed) {
            throw new Error(`LLM review blocked round: ${review.concerns.join(', ')}`);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('LLM review blocked')) throw err;
        logger.warn({ err }, 'LLM review failed, proceeding');
      }
    }

    roundsRepo.updateStatus(roundId, 'signing');
    logger.info({ roundId }, 'Phase 4: Signing allocation plan');
    const planHash = '0x' + crypto.createHash('sha256').update(planData).digest('hex');
    const agentSignature = await poolWallet.signData(planHash);
    plan.agentSignature = agentSignature;
    plan.planHash = planHash;

    roundsRepo.update(roundId, { plan_hash: planHash, agent_signature: agentSignature });

    return plan;
  }

  private async executeAllocations(plan: AllocationPlan): Promise<void> {
    const round = roundsRepo.findById(plan.roundId);
    if (!round) return;
    roundsRepo.updateStatus(plan.roundId, 'executing');
    logger.info({ roundId: plan.roundId, allocations: plan.allocations.length }, 'Phase 5: Executing allocations');
    const poolWallets = new Map<string, PoolWalletManager>();
    const settledTips = new Set<string>();

    for (const alloc of plan.allocations) {
      if (!alloc.walletAddress) {
        logger.warn({ creatorId: alloc.creatorId, chain: alloc.chain }, 'Skipping allocation without wallet address');
        continue;
      }

      const creatorTips = tipsRepo.findByCreatorAndRound(alloc.creatorId, plan.roundId)
        .filter(tip => (tip.status === 'confirmed' || tip.status === 'settled') && Boolean(tip.escrow_address));

      for (const tip of creatorTips) {
        if (tip.status === 'settled' || tip.settlement_tx_hash || settledTips.has(tip.id)) {
          continue;
        }
        try {
          const settlementTxHash = await escrowWallet.consolidateAtRoundEnd(tip.id, alloc.walletAddress);
          tipsRepo.update(tip.id, {
            status: 'settled',
            settlement_tx_hash: settlementTxHash,
            settled_at: new Date().toISOString(),
          });
          settledTips.add(tip.id);
          logger.info({ tipId: tip.id, creatorId: alloc.creatorId, settlementTxHash }, 'Escrow consolidated into creator wallet');
        } catch (err) {
          logger.error({ err, tipId: tip.id, creatorId: alloc.creatorId }, 'Escrow consolidation failed');
        }
      }

      if (alloc.matchAmount <= 0n) {
        continue;
      }
      try {
        if (!poolWallets.has(alloc.chain)) {
          poolWallets.set(alloc.chain, new PoolWalletManager(alloc.chain));
        }
        const chainPoolWallet = poolWallets.get(alloc.chain)!;
        const { unsignedTx } = await chainPoolWallet.buildTransaction(alloc.walletAddress, alloc.matchAmount);
        const txHash = await chainPoolWallet.executeTransaction(unsignedTx, plan.agentSignature ?? '');
        alloc.txHash = txHash;
        logger.info({ creatorId: alloc.creatorId, chain: alloc.chain, txHash }, 'Match allocated');
      } catch (err) {
        logger.error({ err, creatorId: alloc.creatorId, chain: alloc.chain }, 'Allocation execution failed');
      }
    }
  }

  private async archiveRound(roundId: string, plan: AllocationPlan): Promise<void> {
    roundsRepo.updateStatus(roundId, 'archiving');
    logger.info({ roundId }, 'Phase 6: Archiving round');

    try {
      const result = await publishRoundReport(roundId, plan);
      roundsRepo.update(roundId, {
        ipfs_cid: result.cid,
        ipfs_url: result.url,
        total_matched: plan.totalMatched.toString(),
        pool_used: plan.totalMatched.toString(),
        ended_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn({ err }, 'IPFS publish failed, continuing');
    }

    roundsRepo.updateStatus(roundId, 'completed');
  }

  private async resetRound(): Promise<void> {
    logger.info('Phase 7: Creating new round');
    const nextNumber = roundsRepo.getNextRoundNumber();
    roundsRepo.create(nextNumber);
    logger.info({ roundNumber: nextNumber }, 'New round created');
  }
}
