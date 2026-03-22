import { PoolMonitor } from '../agent/pool-monitor.js';
import { computeQuadraticScore } from '../quadratic/index.js';
import { SupportedChain } from '../config/chains.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundRecord, RoundsRepository } from '../storage/repositories/rounds.js';
import { SybilFlagRecord, SybilFlagsRepository } from '../storage/repositories/sybil-flags.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { baseUnitsToUsdt } from '../utils/math.js';

export interface DashboardRoundSnapshot {
  id: string;
  round_number: number;
  status: RoundRecord['status'];
  started_at: string;
  ended_at?: string;
  matching_multiplier: number;
  total_direct_tips: string;
  total_direct_tips_base_units: string;
  total_matched: string;
  total_matched_base_units: string;
  pool_used: string;
  pool_used_base_units: string;
  ipfs_cid?: string;
  ipfs_url?: string;
  plan_hash?: string;
  agent_signature?: string;
  tipper_count: number;
  creator_count: number;
  sybil_flags_count: number;
}

export interface DashboardLeaderboardEntry {
  creator: string;
  score: string;
  total: string;
  total_base_units: string;
}

export interface DashboardPoolSnapshot {
  balance: string;
  balance_base_units: string;
  multiplier: number;
  projectedPoolUsage: string;
  projectedPoolUsage_base_units: string;
  roundsUntilDepletion: number;
  totalDistributed: string;
  totalDistributed_base_units: string;
  chainBalances: Array<{
    chain: SupportedChain;
    balance: string;
    balance_base_units: string;
  }>;
}

const roundsRepo = new RoundsRepository();
const tipsRepo = new TipsRepository();
const flagsRepo = new SybilFlagsRepository();
const creatorsRepo = new CreatorsRepository();
const poolMonitor = new PoolMonitor();

function stringifyUnits(units: bigint): { display: string; raw: string } {
  return {
    display: baseUnitsToUsdt(units),
    raw: units.toString(),
  };
}

function buildRoundSnapshot(round: RoundRecord): DashboardRoundSnapshot {
  const confirmedTips = tipsRepo.findConfirmedByRound(round.id);
  const totalDirectTips = confirmedTips.reduce((sum, tip) => sum + BigInt(tip.amount_usdt), 0n);
  const totalMatched = BigInt(round.total_matched);
  const poolUsed = BigInt(round.pool_used);
  const directTips = stringifyUnits(totalDirectTips);
  const matched = stringifyUnits(totalMatched);
  const pool = stringifyUnits(poolUsed);
  const tipperCount = new Set(confirmedTips.map(tip => tip.tipper_telegram_id)).size;
  const creatorCount = new Set(confirmedTips.map(tip => tip.creator_id)).size;
  const sybilFlagsCount = flagsRepo.countFlaggedByRound(round.id);

  return {
    id: round.id,
    round_number: round.round_number,
    status: round.status,
    started_at: round.started_at,
    ended_at: round.ended_at,
    matching_multiplier: round.matching_multiplier,
    total_direct_tips: directTips.display,
    total_direct_tips_base_units: directTips.raw,
    total_matched: matched.display,
    total_matched_base_units: matched.raw,
    pool_used: pool.display,
    pool_used_base_units: pool.raw,
    ipfs_cid: round.ipfs_cid,
    ipfs_url: round.ipfs_url,
    plan_hash: round.plan_hash,
    agent_signature: round.agent_signature,
    tipper_count: tipperCount,
    creator_count: creatorCount,
    sybil_flags_count: sybilFlagsCount,
  };
}

export function getCurrentRoundSnapshot(): DashboardRoundSnapshot | null {
  const round = roundsRepo.findCurrent();
  return round ? buildRoundSnapshot(round) : null;
}

export function getRoundLeaderboardSnapshot(round?: RoundRecord | null): DashboardLeaderboardEntry[] {
  const targetRound = round ?? roundsRepo.findCurrent() ?? roundsRepo.findLatestCompleted();
  if (!targetRound) return [];

  const tips = tipsRepo.findConfirmedByRound(targetRound.id);
  const byCreator = new Map<string, bigint[]>();

  for (const tip of tips) {
    if (!byCreator.has(tip.creator_id)) {
      byCreator.set(tip.creator_id, []);
    }
    byCreator.get(tip.creator_id)!.push(BigInt(tip.effective_amount));
  }

  return Array.from(byCreator.entries())
    .map(([id, contribs]) => {
      const creator = creatorsRepo.findById(id);
      const total = contribs.reduce((sum, value) => sum + value, 0n);
      return {
        creator: creator?.username ?? id,
        score: computeQuadraticScore(contribs).toString(),
        total: baseUnitsToUsdt(total),
        total_base_units: total.toString(),
      };
    })
    .sort((a, b) => (BigInt(b.score) > BigInt(a.score) ? 1 : -1));
}

export async function getPoolSnapshot(): Promise<DashboardPoolSnapshot> {
  const report = await poolMonitor.generatePoolReport();
  const balance = stringifyUnits(report.balance);
  const projectedPoolUsage = stringifyUnits(report.projectedPoolUsage);
  const totalDistributed = stringifyUnits(report.totalDistributedAllTime);

  return {
    balance: balance.display,
    balance_base_units: balance.raw,
    multiplier: report.multiplier,
    projectedPoolUsage: projectedPoolUsage.display,
    projectedPoolUsage_base_units: projectedPoolUsage.raw,
    roundsUntilDepletion: report.roundsUntilDepletion,
    totalDistributed: totalDistributed.display,
    totalDistributed_base_units: totalDistributed.raw,
    chainBalances: report.chainBalances.map(chainBalance => {
      const balanceByChain = stringifyUnits(chainBalance.balance);
      return {
        chain: chainBalance.chain,
        balance: balanceByChain.display,
        balance_base_units: balanceByChain.raw,
      };
    }),
  };
}

export function getCurrentRoundSybilFlags(): SybilFlagRecord[] {
  const round = roundsRepo.findCurrent();
  if (!round) return [];
  return flagsRepo.findFlaggedByRound(round.id);
}

export function getRecentRoundSnapshots(limit = 20): DashboardRoundSnapshot[] {
  return roundsRepo.findAll(limit).map(buildRoundSnapshot);
}
