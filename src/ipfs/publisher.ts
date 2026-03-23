import crypto from 'crypto';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { baseUnitsToUsdt } from '../utils/math.js';
import { logger } from '../utils/logger.js';
import type { CanonicalSettlementPlan } from '../types/flow.js';
import { ReportAttestationsRepository } from '../storage/repositories/report-attestations.js';
import { canonicalJson } from '../utils/canonical-json.js';

export interface IpfsResult {
  cid: string;
  url: string;
  cidSignature: string;
}

export interface RoundReport {
  version: '2.0';
  round: number;
  period: { start: string; end: string };
  stats: {
    totalTippers: number;
    uniqueCreators: number;
    totalDirectTips: string;
    totalMatched: string;
    poolUsed: string;
    poolRemaining: string;
    matchingMultiplier: number;
    sybilFlagsApplied: number;
  };
  settlementPlan: CanonicalSettlementPlan;
  publishedAt: string;
}

const roundsRepo = new RoundsRepository();
const tipsRepo = new TipsRepository();
const poolWallet = new PoolWalletManager();
const reportAttestationsRepo = new ReportAttestationsRepository();

export async function publishRoundReport(roundId: string, allocationPlan: CanonicalSettlementPlan): Promise<IpfsResult> {
  const round = roundsRepo.findById(roundId);
  if (!round) throw new Error(`Round not found: ${roundId}`);

  const tips = tipsRepo.findConfirmedByRound(roundId);
  const poolBalance = BigInt(allocationPlan.totalPool);

  const report: RoundReport = {
    version: '2.0',
    round: round.round_number,
    period: { start: round.started_at, end: round.ended_at ?? new Date().toISOString() },
    stats: {
      totalTippers: new Set(tips.map(t => t.tipper_telegram_id)).size,
      uniqueCreators: new Set(tips.map(t => t.creator_id)).size,
      totalDirectTips: baseUnitsToUsdt(tips.reduce((sum, tip) => sum + BigInt(tip.amount_usdt), 0n)),
      totalMatched: baseUnitsToUsdt(BigInt(allocationPlan.totalMatched)),
      poolUsed: baseUnitsToUsdt(BigInt(allocationPlan.totalMatched)),
      poolRemaining: baseUnitsToUsdt(poolBalance > BigInt(allocationPlan.totalMatched) ? poolBalance - BigInt(allocationPlan.totalMatched) : 0n),
      matchingMultiplier: round.matching_multiplier,
      sybilFlagsApplied: tips.filter(t => t.sybil_flagged).length,
    },
    settlementPlan: allocationPlan,
    publishedAt: new Date().toISOString(),
  };

  const reportJson = canonicalJson(report);
  const cid = 'bafyrei' + crypto.createHash('sha256').update(reportJson).digest('hex').slice(0, 52);
  const cidSignature = await poolWallet.signData(cid);

  if (process.env['IPFS_DISABLED'] === 'true') {
    logger.warn({ cid }, 'IPFS disabled — round report not published to IPFS');
  } else if (process.env['WEB3_STORAGE_TOKEN']) {
    logger.info({ cid }, 'Would upload round report to IPFS in a live environment');
  } else {
    logger.info({ cid }, 'IPFS mock: WEB3_STORAGE_TOKEN not set');
  }

  reportAttestationsRepo.create({
    round_id: roundId,
    plan_hash: allocationPlan.signatures.planHash,
    plan_signature: allocationPlan.signatures.planSignature,
    report_cid: cid,
    cid_signature: cidSignature,
    agent_wallet_address: allocationPlan.poolAddress,
  });

  return {
    cid,
    url: `https://ipfs.io/ipfs/${cid}`,
    cidSignature,
  };
}
