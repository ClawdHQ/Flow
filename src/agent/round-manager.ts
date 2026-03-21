import cron from 'node-cron';
import crypto from 'crypto';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { SybilDetector } from './sybil.js';
import { computeRoundAllocations, AllocationPlan } from '../quadratic/allocator.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { publishRoundReport } from '../ipfs/publisher.js';
import { logger } from '../utils/logger.js';
import { ROUND_REVIEW_PROMPT } from './prompts.js';
import { llmClient, getModelName } from '../utils/llm-client.js';

const roundsRepo = new RoundsRepository();
const tipsRepo = new TipsRepository();
const sybilDetector = new SybilDetector();
const poolWallet = new PoolWalletManager();

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
      const plan = await this.signAllocationPlan(roundId);
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

  private async signAllocationPlan(roundId: string): Promise<AllocationPlan> {
    roundsRepo.updateStatus(roundId, 'signing');
    logger.info({ roundId }, 'Phase 3: Signing allocation plan');

    const plan = await computeRoundAllocations(roundId);

    // Serialize and hash the plan
    const planData = JSON.stringify({
      ...plan,
      allocations: plan.allocations.map(a => ({
        ...a,
        directTips: a.directTips.toString(),
        matchAmount: a.matchAmount.toString(),
        score: a.score.toString(),
      })),
      totalPool: plan.totalPool.toString(),
      totalMatched: plan.totalMatched.toString(),
    });
    const planHash = '0x' + crypto.createHash('sha256').update(planData).digest('hex');

    // LLM review
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

    const agentSignature = await poolWallet.signData(planHash);
    plan.agentSignature = agentSignature;

    roundsRepo.update(roundId, { plan_hash: planHash, agent_signature: agentSignature });

    return plan;
  }

  private async executeAllocations(plan: AllocationPlan): Promise<void> {
    const round = roundsRepo.findById(plan.roundId);
    if (!round) return;
    roundsRepo.updateStatus(plan.roundId, 'executing');
    logger.info({ roundId: plan.roundId, allocations: plan.allocations.length }, 'Phase 4: Executing allocations');

    for (const alloc of plan.allocations) {
      if (alloc.matchAmount <= 0n) continue;
      try {
        const { unsignedTx } = await poolWallet.buildTransaction(alloc.creatorId, alloc.matchAmount);
        const txHash = await poolWallet.executeTransaction(unsignedTx, plan.agentSignature ?? '');
        logger.info({ creatorId: alloc.creatorId, txHash }, 'Match allocated');
      } catch (err) {
        logger.error({ err, creatorId: alloc.creatorId }, 'Allocation execution failed');
      }
    }
  }

  private async archiveRound(roundId: string, plan: AllocationPlan): Promise<void> {
    roundsRepo.updateStatus(roundId, 'archiving');
    logger.info({ roundId }, 'Phase 5: Archiving round');

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
    logger.info('Phase 6: Creating new round');
    const nextNumber = roundsRepo.getNextRoundNumber();
    roundsRepo.create(nextNumber);
    logger.info({ roundNumber: nextNumber }, 'New round created');
  }
}
