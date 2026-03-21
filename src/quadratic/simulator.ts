import { computeAllocations, CreatorContributions } from './index.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { PoolWalletManager } from '../wallet/pool.js';

export interface SimulationResult {
  roundId: string;
  projectedAllocations: {
    creatorId: string;
    username: string;
    directTips: bigint;
    projectedMatch: bigint;
    uniqueTippers: number;
  }[];
  poolBalance: bigint;
  multiplier: number;
}

const tipsRepo = new TipsRepository();
const creatorsRepo = new CreatorsRepository();
const roundsRepo = new RoundsRepository();
const poolWallet = new PoolWalletManager();

export async function simulateCurrentRound(): Promise<SimulationResult> {
  const round = roundsRepo.findCurrent();
  if (!round) throw new Error('No active round found');

  const tips = tipsRepo.findConfirmedByRound(round.id);
  const byCreator = new Map<string, bigint[]>();
  const uniqueTippers = new Map<string, Set<string>>();

  for (const tip of tips) {
    const amount = BigInt(tip.effective_amount);
    if (!byCreator.has(tip.creator_id)) {
      byCreator.set(tip.creator_id, []);
      uniqueTippers.set(tip.creator_id, new Set());
    }
    byCreator.get(tip.creator_id)!.push(amount);
    uniqueTippers.get(tip.creator_id)!.add(tip.tipper_telegram_id);
  }

  const creators: CreatorContributions[] = Array.from(byCreator.entries()).map(([id, contributions]) => ({ id, contributions }));
  const poolBalance = await poolWallet.getBalance();
  const allocs = computeAllocations(creators, poolBalance);

  const projectedAllocations = allocs.map(a => {
    const creator = creatorsRepo.findById(a.creatorId);
    return {
      creatorId: a.creatorId,
      username: creator?.username ?? 'unknown',
      directTips: byCreator.get(a.creatorId)?.reduce((s, v) => s + v, 0n) ?? 0n,
      projectedMatch: a.matchAmount,
      uniqueTippers: uniqueTippers.get(a.creatorId)?.size ?? 0,
    };
  });

  return {
    roundId: round.id,
    projectedAllocations,
    poolBalance,
    multiplier: round.matching_multiplier,
  };
}
