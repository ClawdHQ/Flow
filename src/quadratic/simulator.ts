import { computeRoundAllocations } from './allocator.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { SupportedChain } from '../config/chains.js';

export interface SimulationResult {
  roundId: string;
  projectedAllocations: {
    creatorId: string;
    username: string;
    chain: SupportedChain;
    directTips: bigint;
    projectedMatch: bigint;
    uniqueTippers: number;
  }[];
  poolBalance: bigint;
  multiplier: number;
}

const creatorsRepo = new CreatorsRepository();
const roundsRepo = new RoundsRepository();

export async function simulateCurrentRound(): Promise<SimulationResult> {
  const round = roundsRepo.findCurrent();
  if (!round) throw new Error('No active round found');

  const plan = await computeRoundAllocations(round.id);
  const projectedAllocations = plan.allocations.map(a => {
    const creator = creatorsRepo.findById(a.creatorId);
    return {
      creatorId: a.creatorId,
      username: creator?.username ?? 'unknown',
      chain: a.chain,
      directTips: a.directTips,
      projectedMatch: a.matchAmount,
      uniqueTippers: a.uniqueTippers,
    };
  });

  return {
    roundId: round.id,
    projectedAllocations,
    poolBalance: plan.totalPool,
    multiplier: round.matching_multiplier,
  };
}
