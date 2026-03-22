import { PoolMonitor } from '../agent/pool-monitor.js';
import { config } from '../config/index.js';
import { computeQuadraticScore } from '../quadratic/index.js';
import { SupportedChain } from '../config/chains.js';
import { AutoTipExecutionsRepository } from '../storage/repositories/auto-tip-executions.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { MilestoneBonusesRepository } from '../storage/repositories/milestone-bonuses.js';
import { RoundRecord, RoundsRepository } from '../storage/repositories/rounds.js';
import { RumbleCreatorLinksRepository } from '../storage/repositories/rumble-creator-links.js';
import { RumbleEventsRepository } from '../storage/repositories/rumble-events.js';
import { SybilFlagRecord, SybilFlagsRepository } from '../storage/repositories/sybil-flags.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { baseUnitsToUsdt } from '../utils/math.js';
import { formatAmount, type SupportedToken } from '../tokens/index.js';

export interface DashboardRoundSnapshot {
  id: string;
  round_number: number;
  status: RoundRecord['status'];
  started_at: string;
  closes_at?: string;
  seconds_remaining?: number;
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
  unique_tippers: number;
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

export interface DashboardRumbleEventSnapshot {
  event_id: string;
  event_type: string;
  creator_id: string;
  creator_handle: string;
  video_id?: string;
  video_title?: string;
  viewer_id?: string;
  created_at: string;
}

export interface DashboardRumbleAutoTipSnapshot {
  creator_id: string;
  creator: string;
  rumble_handle?: string;
  tip_count: number;
  total: string;
  total_base: string;
  token: SupportedToken;
  date: string;
}

export interface DashboardMilestoneBonusSnapshot {
  creator_id: string;
  creator: string;
  rumble_handle?: string;
  milestone_value: number;
  bonus_amount: string;
  bonus_amount_base: string;
  token: SupportedToken;
  tx_hash?: string;
  paid_at: string;
}

export interface DashboardRumbleSummarySnapshot {
  today_auto_tip_count: number;
  today_auto_tip_total: string;
  all_time_auto_tip_count: number;
  all_time_auto_tip_total: string;
}

const roundsRepo = new RoundsRepository();
const tipsRepo = new TipsRepository();
const flagsRepo = new SybilFlagsRepository();
const creatorsRepo = new CreatorsRepository();
const autoTipExecutionsRepo = new AutoTipExecutionsRepository();
const milestoneBonusesRepo = new MilestoneBonusesRepository();
const rumbleCreatorLinksRepo = new RumbleCreatorLinksRepository();
const rumbleEventsRepo = new RumbleEventsRepository();
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
  const startedAtMs = Date.parse(round.started_at);
  const roundDurationMs = config.ROUND_DURATION_HOURS * 60 * 60 * 1000;
  const closesAt = Number.isFinite(startedAtMs)
    ? new Date(startedAtMs + roundDurationMs).toISOString()
    : undefined;
  const secondsRemaining = closesAt
    ? Math.max(0, Math.floor((Date.parse(closesAt) - Date.now()) / 1000))
    : undefined;

  return {
    id: round.id,
    round_number: round.round_number,
    status: round.status,
    started_at: round.started_at,
    closes_at: closesAt,
    seconds_remaining: secondsRemaining,
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
      const uniqueTippers = new Set(
        tips
          .filter(tip => tip.creator_id === id)
          .map(tip => tip.tipper_telegram_id)
      ).size;
      return {
        creator: creator?.username ?? id,
        score: computeQuadraticScore(contribs).toString(),
        total: baseUnitsToUsdt(total),
        total_base_units: total.toString(),
        unique_tippers: uniqueTippers,
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

export function getRecentRumbleEvents(limit = 50): DashboardRumbleEventSnapshot[] {
  return rumbleEventsRepo.listRecent(limit).map(event => ({
    event_id: event.event_id,
    event_type: event.event_type,
    creator_id: event.creator_id,
    creator_handle: event.creator_handle,
    video_id: event.video_id,
    video_title: event.video_title,
    viewer_id: event.viewer_id,
    created_at: event.created_at,
  }));
}

export function getRumbleAutoTipStats(days = 7): DashboardRumbleAutoTipSnapshot[] {
  return autoTipExecutionsRepo.listRecentStats(days).map(stat => {
    const creator = creatorsRepo.findById(stat.creator_id);
    const link = rumbleCreatorLinksRepo.findByCreatorId(stat.creator_id);
    return {
      creator_id: stat.creator_id,
      creator: creator?.username ?? stat.creator_id,
      rumble_handle: link?.rumble_handle,
      tip_count: stat.tip_count,
      total: formatAmount(BigInt(stat.total_base), stat.token),
      total_base: stat.total_base,
      token: stat.token,
      date: stat.date,
    };
  });
}

export function getRecentMilestoneBonuses(limit = 20): DashboardMilestoneBonusSnapshot[] {
  return milestoneBonusesRepo.listRecent(limit).map(bonus => {
    const creator = creatorsRepo.findById(bonus.creator_id);
    const link = rumbleCreatorLinksRepo.findByCreatorId(bonus.creator_id);
    return {
      creator_id: bonus.creator_id,
      creator: creator?.username ?? bonus.creator_id,
      rumble_handle: link?.rumble_handle,
      milestone_value: bonus.milestone_value,
      bonus_amount: formatAmount(BigInt(bonus.bonus_amount), bonus.token),
      bonus_amount_base: bonus.bonus_amount,
      token: bonus.token,
      tx_hash: bonus.tx_hash,
      paid_at: bonus.paid_at,
    };
  });
}

export function getRumbleSummary(): DashboardRumbleSummarySnapshot {
  const summary = autoTipExecutionsRepo.getSummary();
  return {
    today_auto_tip_count: summary.todayTipCount,
    today_auto_tip_total: formatAmount(summary.todayTotalBase, 'USDT'),
    all_time_auto_tip_count: summary.allTimeTipCount,
    all_time_auto_tip_total: formatAmount(summary.allTimeTotalBase, 'USDT'),
  };
}
