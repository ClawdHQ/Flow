import { computeAllocations, CreatorContributions } from './index.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { CreatorWalletManager } from '../wallet/creator.js';
import { SupportedChain, SUPPORTED_CHAINS } from '../config/chains.js';
import { resolveSupportedChain } from '../wallet/addresses.js';

export interface AllocationPlan {
  roundId: string;
  computedAt: string;
  allocations: {
    creatorId: string;
    walletAddress: string;
    chain: SupportedChain;
    directTips: bigint;
    matchAmount: bigint;
    score: bigint;
    uniqueTippers: number;
    txHash?: string;
  }[];
  poolBreakdown: {
    chain: SupportedChain;
    balance: bigint;
  }[];
  totalPool: bigint;
  totalMatched: bigint;
  planHash?: string;
  agentSignature?: string;
}

const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const creatorWallet = new CreatorWalletManager();

export async function computeRoundAllocations(roundId: string): Promise<AllocationPlan> {
  const round = roundsRepo.findById(roundId);
  if (!round) throw new Error(`Round not found: ${roundId}`);

  const confirmedTips = tipsRepo.findConfirmedByRound(roundId);
  const multiplier = BigInt(Math.round(round.matching_multiplier * 100));
  const allocations: AllocationPlan['allocations'] = [];
  const poolBreakdown: AllocationPlan['poolBreakdown'] = [];

  for (const chain of SUPPORTED_CHAINS) {
    const chainTips = confirmedTips.filter(tip => resolveSupportedChain(tip.chain) === chain);
    const poolBalance = await new PoolWalletManager(chain).getBalance();

    if (poolBalance > 0n || chainTips.length > 0) {
      poolBreakdown.push({ chain, balance: poolBalance });
    }

    if (chainTips.length === 0) {
      continue;
    }

    const byCreator = new Map<string, bigint[]>();
    const uniqueTippersByCreator = new Map<string, Set<string>>();

    for (const tip of chainTips) {
      const effectiveAmount = BigInt(tip.effective_amount);
      const weightPpm = BigInt(Math.round(tip.sybil_weight * 1_000_000));
      const weighted = (effectiveAmount * weightPpm) / 1_000_000n;
      if (!byCreator.has(tip.creator_id)) {
        byCreator.set(tip.creator_id, []);
        uniqueTippersByCreator.set(tip.creator_id, new Set());
      }
      byCreator.get(tip.creator_id)!.push(weighted);
      uniqueTippersByCreator.get(tip.creator_id)!.add(tip.tipper_telegram_id);
    }

    const creatorContribs: CreatorContributions[] = Array.from(byCreator.entries())
      .map(([id, contributions]) => ({ id, contributions }));
    const rawAllocations = computeAllocations(creatorContribs, poolBalance);

    for (const alloc of rawAllocations) {
      const directTips = byCreator.get(alloc.creatorId)?.reduce((s, v) => s + v, 0n) ?? 0n;
      const boosted = (alloc.matchAmount * multiplier) / 100n;
      const capped = boosted > directTips * 3n ? directTips * 3n : boosted;
      const wallet = await creatorWallet.getOrCreateWallet(alloc.creatorId);
      allocations.push({
        creatorId: alloc.creatorId,
        walletAddress: wallet.address,
        chain: wallet.chain,
        directTips,
        matchAmount: capped,
        score: alloc.score,
        uniqueTippers: uniqueTippersByCreator.get(alloc.creatorId)?.size ?? 0,
      });
    }
  }

  const totalPool = poolBreakdown.reduce((sum, pool) => sum + pool.balance, 0n);
  const totalMatched = allocations.reduce((s, a) => s + a.matchAmount, 0n);

  return {
    roundId,
    computedAt: new Date().toISOString(),
    allocations,
    poolBreakdown,
    totalPool,
    totalMatched,
  };
}
