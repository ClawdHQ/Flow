import { computeAllocations, CreatorContributions } from './index.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { PoolWalletManager } from '../wallet/pool.js';

export interface AllocationPlan {
  roundId: string;
  computedAt: string;
  allocations: {
    creatorId: string;
    directTips: bigint;
    matchAmount: bigint;
    score: bigint;
    uniqueTippers: number;
  }[];
  totalPool: bigint;
  totalMatched: bigint;
  agentSignature?: string;
}

const tipsRepo = new TipsRepository();
const creatorsRepo = new CreatorsRepository();
const roundsRepo = new RoundsRepository();
const poolWallet = new PoolWalletManager();

export async function computeRoundAllocations(roundId: string): Promise<AllocationPlan> {
  const round = roundsRepo.findById(roundId);
  if (!round) throw new Error(`Round not found: ${roundId}`);

  const confirmedTips = tipsRepo.findConfirmedByRound(roundId);

  // Group by creator, apply sybil weights
  const byCreator = new Map<string, bigint[]>();
  const uniqueTippersByCreator = new Map<string, Set<string>>();

  for (const tip of confirmedTips) {
    const effectiveAmount = BigInt(tip.effective_amount);
    // Use integer arithmetic to avoid float precision loss: weight scaled to 1000
    const weightPpm = BigInt(Math.round(tip.sybil_weight * 1_000_000));
    const weighted = (effectiveAmount * weightPpm) / 1_000_000n;
    if (!byCreator.has(tip.creator_id)) {
      byCreator.set(tip.creator_id, []);
      uniqueTippersByCreator.set(tip.creator_id, new Set());
    }
    byCreator.get(tip.creator_id)!.push(weighted);
    uniqueTippersByCreator.get(tip.creator_id)!.add(tip.tipper_telegram_id);
  }

  const creatorContribs: CreatorContributions[] = Array.from(byCreator.entries()).map(([id, contributions]) => ({ id, contributions }));

  // Get pool balance and multiplier
  const poolBalance = await poolWallet.getBalance();
  const multiplier = BigInt(Math.round(round.matching_multiplier * 100));

  const rawAllocations = computeAllocations(creatorContribs, poolBalance);

  // Apply multiplier and 3× cap
  const allocations = rawAllocations.map(alloc => {
    const directTips = byCreator.get(alloc.creatorId)?.reduce((s, v) => s + v, 0n) ?? 0n;
    const boosted = (alloc.matchAmount * multiplier) / 100n;
    const capped = boosted > directTips * 3n ? directTips * 3n : boosted;
    return {
      creatorId: alloc.creatorId,
      directTips,
      matchAmount: capped,
      score: alloc.score,
      uniqueTippers: uniqueTippersByCreator.get(alloc.creatorId)?.size ?? 0,
    };
  });

  const totalMatched = allocations.reduce((s, a) => s + a.matchAmount, 0n);

  return {
    roundId,
    computedAt: new Date().toISOString(),
    allocations,
    totalPool: poolBalance,
    totalMatched,
  };
}
