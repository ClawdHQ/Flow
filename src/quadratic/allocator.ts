import { computeAllocations, CreatorContributions } from './index.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { CreatorWalletManager } from '../wallet/creator.js';
import { getPoolHomeChain, isBridgeEligibleChain, normalizeChain } from '../config/chains.js';
import type { CanonicalBridgeAction, CanonicalSettlementPlan } from '../types/flow.js';

export type AllocationPlan = CanonicalSettlementPlan;

const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

export async function computeRoundAllocations(roundId: string): Promise<AllocationPlan> {
  const round = roundsRepo.findById(roundId);
  if (!round) throw new Error(`Round not found: ${roundId}`);

  const confirmedTips = tipsRepo.findConfirmedByRound(roundId);
  const contributionsByCreator = new Map<string, bigint[]>();
  const uniqueTippersByCreator = new Map<string, Set<string>>();

  for (const tip of confirmedTips) {
    const effectiveAmount = BigInt(tip.effective_amount);
    const weightPpm = BigInt(Math.round(tip.sybil_weight * 1_000_000));
    const weighted = (effectiveAmount * weightPpm) / 1_000_000n;
    if (!contributionsByCreator.has(tip.creator_id)) {
      contributionsByCreator.set(tip.creator_id, []);
      uniqueTippersByCreator.set(tip.creator_id, new Set());
    }
    contributionsByCreator.get(tip.creator_id)!.push(weighted);
    uniqueTippersByCreator.get(tip.creator_id)!.add(tip.tipper_telegram_id);
  }

  const creatorContribs: CreatorContributions[] = Array.from(contributionsByCreator.entries())
    .map(([id, contributions]) => ({ id, contributions }));

  const poolWallet = new PoolWalletManager();
  const totalPool = await poolWallet.getBalance();
  const rawAllocations = computeAllocations(creatorContribs, totalPool);
  const poolInfo = await poolWallet.getAddress();
  const bridgeActions: CanonicalBridgeAction[] = [];
  const allocations = [];

  for (const [index, alloc] of rawAllocations.entries()) {
    const directTips = contributionsByCreator.get(alloc.creatorId)?.reduce((sum, value) => sum + value, 0n) ?? 0n;
    const boosted = (alloc.matchAmount * BigInt(Math.round(round.matching_multiplier * 100))) / 100n;
    const capped = boosted > directTips * 3n ? directTips * 3n : boosted;
    const destination = await creatorWallet.getPayoutDestination(alloc.creatorId);
    const creator = await creatorWallet.getOrCreateWallet(alloc.creatorId);
    const creatorRecord = creatorsRepo.findById(alloc.creatorId);
    const targetChain = normalizeChain(destination.network);
    const settlementMode: 'direct' | 'bridge' = targetChain && destination.network !== getPoolHomeChain() && isBridgeEligibleChain(targetChain)
      ? 'bridge'
      : 'direct';
    let bridgeActionId: string | undefined;
    if (settlementMode === 'bridge') {
      bridgeActionId = `${roundId}:bridge:${index}`;
      bridgeActions.push({
        id: bridgeActionId,
        creatorId: alloc.creatorId,
        sourceNetwork: getPoolHomeChain(),
        destinationNetwork: destination.network,
        token: destination.token,
        amount: capped.toString(),
        status: 'planned',
      });
    }

    allocations.push({
      creatorId: alloc.creatorId,
      creatorUsername: creatorRecord?.username ?? alloc.creatorId,
      payoutAddress: destination.address ?? creator.address,
      payoutFamily: destination.family,
      payoutNetwork: destination.network,
      payoutToken: destination.token,
      directTips: directTips.toString(),
      matchAmount: capped.toString(),
      score: alloc.score.toString(),
      uniqueTippers: uniqueTippersByCreator.get(alloc.creatorId)?.size ?? 0,
      settlementMode,
      bridgeActionId,
    });
  }

  return {
    roundId,
    roundNumber: round.round_number,
    computedAt: new Date().toISOString(),
    poolFamily: 'evm_erc4337',
    poolNetwork: getPoolHomeChain(),
    poolAddress: poolInfo,
    totalPool: totalPool.toString(),
    totalMatched: allocations.reduce((sum, allocation) => sum + BigInt(allocation.matchAmount), 0n).toString(),
    allocations,
    bridgeActions,
    signatures: {
      planHash: '',
      planSignature: '',
    },
    executionReceipts: [],
  };
}
