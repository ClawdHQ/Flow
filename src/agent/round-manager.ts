import cron from 'node-cron';
import crypto from 'crypto';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { SybilDetector } from './sybil.js';
import { computeRoundAllocations, AllocationPlan } from '../quadratic/allocator.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { publishRoundReport } from '../ipfs/publisher.js';
import { logger } from '../utils/logger.js';
import { ROUND_REVIEW_PROMPT } from './prompts.js';
import { llmClient, getModelName } from '../utils/llm-client.js';
import { canonicalJson } from '../utils/canonical-json.js';
import { RoundAllocationsRepository } from '../storage/repositories/round-allocations.js';
import { BridgeTransfersRepository } from '../storage/repositories/bridge-transfers.js';
import { SettlementExecutionsRepository } from '../storage/repositories/settlement-executions.js';
import { settlementNotifier } from '../notifications/settlement-notifier.js';
import { overlayHub } from '../realtime/overlay-hub.js';
import { EscrowWalletManager } from '../wallet/escrow.js';
import { CreatorWalletManager } from '../wallet/creator.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';

const roundsRepo = new RoundsRepository();
const sybilDetector = new SybilDetector();
const poolWallet = new PoolWalletManager();
const roundAllocationsRepo = new RoundAllocationsRepository();
const bridgeTransfersRepo = new BridgeTransfersRepository();
const settlementExecutionsRepo = new SettlementExecutionsRepository();
const escrowManager = new EscrowWalletManager();
const tipsRepo = new TipsRepository();
const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

function hashCanonical(value: unknown): string {
  return '0x' + crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export class RoundManager {
  private task: cron.ScheduledTask | null = null;

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
    const planToReview = {
      ...plan,
      signatures: { planHash: '', planSignature: '' },
      executionReceipts: [],
    };
    const planData = canonicalJson(planToReview);

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
    const planHash = hashCanonical(planToReview);
    const planSignature = await poolWallet.signData(planHash);
    plan.signatures.planHash = planHash;
    plan.signatures.planSignature = planSignature;

    roundAllocationsRepo.replaceForRound(roundId, plan.allocations.map(allocation => ({
      creator_id: allocation.creatorId,
      payout_address: allocation.payoutAddress,
      payout_family: allocation.payoutFamily,
      payout_network: allocation.payoutNetwork,
      payout_token: allocation.payoutToken,
      direct_tips: allocation.directTips,
      match_amount: allocation.matchAmount,
      score: allocation.score,
      unique_tippers: allocation.uniqueTippers,
      settlement_mode: allocation.settlementMode,
      tx_hash: allocation.txHash,
    })));

    roundsRepo.update(roundId, {
      plan_hash: planHash,
      agent_signature: planSignature,
      plan_signature: planSignature,
      plan_json: canonicalJson(plan),
      pool_wallet_address: plan.poolAddress,
    });

    return plan;
  }

  private async executeAllocations(plan: AllocationPlan): Promise<void> {
    roundsRepo.updateStatus(plan.roundId, 'executing');
    logger.info({ roundId: plan.roundId, allocations: plan.allocations.length }, 'Phase 5: Executing allocations');

    for (const bridgeAction of plan.bridgeActions) {
      bridgeTransfersRepo.create({
        round_id: plan.roundId,
        creator_id: bridgeAction.creatorId,
        source_network: bridgeAction.sourceNetwork,
        destination_network: bridgeAction.destinationNetwork,
        token: bridgeAction.token,
        amount: bridgeAction.amount,
        status: bridgeAction.status,
        approve_hash: bridgeAction.approveHash,
        tx_hash: bridgeAction.hash,
        reset_allowance_hash: bridgeAction.resetAllowanceHash,
      });
    }

    for (const [index, allocation] of plan.allocations.entries()) {
      if (BigInt(allocation.matchAmount) <= 0n) {
        continue;
      }
      try {
        const { unsignedTx } = await poolWallet.buildTransaction(allocation.payoutAddress, BigInt(allocation.matchAmount), {
          planHash: plan.signatures.planHash,
          allocationIndex: index,
          creatorId: allocation.creatorId,
        });
        await poolWallet.executeTransaction(unsignedTx, plan.signatures.planSignature);

        const payoutResult = await poolWallet.settlePayout({
          network: allocation.payoutNetwork,
          token: allocation.payoutToken,
          address: allocation.payoutAddress,
        }, BigInt(allocation.matchAmount));

        allocation.txHash = payoutResult.txHash;
        plan.executionReceipts.push({
          allocationIndex: index,
          creatorId: allocation.creatorId,
          mode: payoutResult.mode === 'bridge' ? 'bridge' : 'direct',
          txHash: payoutResult.txHash,
          approveHash: payoutResult.approveHash,
          resetAllowanceHash: payoutResult.resetAllowanceHash,
          status: 'completed',
        });

        settlementExecutionsRepo.create({
          round_id: plan.roundId,
          allocation_index: index,
          creator_id: allocation.creatorId,
          mode: payoutResult.mode,
          status: 'completed',
          tx_hash: payoutResult.txHash,
          approve_hash: payoutResult.approveHash,
          reset_allowance_hash: payoutResult.resetAllowanceHash,
          error: undefined,
        });

        overlayHub.publish({
          type: 'settlement',
          creatorId: allocation.creatorId,
          title: 'Settlement completed',
          subtitle: `${allocation.creatorUsername} received their round payout`,
          amount: allocation.matchAmount,
          token: allocation.payoutToken,
          txHash: payoutResult.txHash,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Allocation execution failed';
        plan.executionReceipts.push({
          allocationIndex: index,
          creatorId: allocation.creatorId,
          mode: allocation.settlementMode,
          status: 'failed',
          error,
        });
        settlementExecutionsRepo.create({
          round_id: plan.roundId,
          allocation_index: index,
          creator_id: allocation.creatorId,
          mode: allocation.settlementMode,
          status: 'failed',
          tx_hash: undefined,
          approve_hash: undefined,
          reset_allowance_hash: undefined,
          error,
        });
        logger.error({ err, creatorId: allocation.creatorId }, 'Allocation execution failed');
      }
    }
  }

  private async archiveRound(roundId: string, plan: AllocationPlan): Promise<void> {
    roundsRepo.updateStatus(roundId, 'archiving');
    logger.info({ roundId }, 'Phase 6: Consolidating direct tips and archiving round');

    // Consolidate escrows
    const tips = tipsRepo.findConfirmedByRound(roundId).filter(t => t.escrow_address && t.status === 'confirmed');
    for (const tip of tips) {
      try {
        const creator = creatorsRepo.findById(tip.creator_id);
        if (creator) {
          const accWallet = await creatorWallet.getOrCreateWallet(creator.id);
          logger.info({ tipId: tip.id, creator: creator.username, target: accWallet.address }, 'Consolidating escrow for tip');
          await escrowManager.consolidateAtRoundEnd(tip.id, accWallet.address);
        }
      } catch (err) {
        logger.error({ err, tipId: tip.id }, 'Failed to consolidate escrow');
      }
    }

    const result = await publishRoundReport(roundId, plan);
    plan.signatures.reportCid = result.cid;
    plan.signatures.cidSignature = result.cidSignature;

    roundsRepo.update(roundId, {
      ipfs_cid: result.cid,
      ipfs_url: result.url,
      total_matched: plan.totalMatched,
      pool_used: plan.totalMatched,
      ended_at: new Date().toISOString(),
      cid_signature: result.cidSignature,
      plan_json: canonicalJson(plan),
    });

    for (const allocation of plan.allocations.filter(entry => entry.txHash)) {
      await settlementNotifier.notifyCreatorSettlement({
        creatorId: allocation.creatorId,
        roundId,
        txHash: allocation.txHash!,
        reportUrl: result.url,
      });
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
