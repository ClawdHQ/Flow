import crypto from 'crypto';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { baseUnitsToUsdt } from '../utils/math.js';
import { logger } from '../utils/logger.js';
import type { AllocationPlan } from '../quadratic/allocator.js';

export interface IpfsResult {
  cid: string;
  url: string;
}

export interface RoundReport {
  version: '1.0';
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
  distributions: {
    creator: string;
    walletAddress: string;
    directTips: string;
    matchAmount: string;
    uniqueTippers: number;
    quadraticScore: string;
    txHash: string;
    chain: string;
  }[];
  agentAttestation: {
    planHash: string;
    agentSignature: string;
    agentWalletAddress: string;
    ipfsSignature: string;
  };
  publishedAt: string;
}

const roundsRepo = new RoundsRepository();
const creatorsRepo = new CreatorsRepository();
const tipsRepo = new TipsRepository();
const poolWallet = new PoolWalletManager();

export async function publishRoundReport(roundId: string, allocationPlan: AllocationPlan): Promise<IpfsResult> {
  const round = roundsRepo.findById(roundId);
  if (!round) throw new Error(`Round not found: ${roundId}`);

  const tips = tipsRepo.findConfirmedByRound(roundId);
  const poolBalance = allocationPlan.totalPool;
  const agentAddress = await poolWallet.getAddress();

  const report: RoundReport = {
    version: '1.0',
    round: round.round_number,
    period: { start: round.started_at, end: round.ended_at ?? new Date().toISOString() },
    stats: {
      totalTippers: new Set(tips.map(t => t.tipper_telegram_id)).size,
      uniqueCreators: new Set(tips.map(t => t.creator_id)).size,
      totalDirectTips: baseUnitsToUsdt(tips.reduce((s, t) => s + BigInt(t.amount_usdt), 0n)),
      totalMatched: baseUnitsToUsdt(allocationPlan.totalMatched),
      poolUsed: baseUnitsToUsdt(allocationPlan.totalMatched),
      poolRemaining: baseUnitsToUsdt(poolBalance > allocationPlan.totalMatched ? poolBalance - allocationPlan.totalMatched : 0n),
      matchingMultiplier: round.matching_multiplier,
      sybilFlagsApplied: tips.filter(t => t.sybil_flagged).length,
    },
    distributions: allocationPlan.allocations.map(a => {
      const creator = creatorsRepo.findById(a.creatorId);
      return {
        creator: creator?.username ?? a.creatorId,
        walletAddress: a.walletAddress,
        directTips: baseUnitsToUsdt(a.directTips),
        matchAmount: baseUnitsToUsdt(a.matchAmount),
        uniqueTippers: a.uniqueTippers,
        quadraticScore: a.score.toString(),
        txHash: a.txHash ?? '',
        chain: a.chain,
      };
    }),
    agentAttestation: {
      planHash: round.plan_hash ?? '',
      agentSignature: allocationPlan.agentSignature ?? '',
      agentWalletAddress: agentAddress,
      ipfsSignature: '',
    },
    publishedAt: new Date().toISOString(),
  };

  const reportJson = JSON.stringify(report);
  // Generate a deterministic CID-like identifier from the report content
  const mockCid = 'bafyrei' + crypto.createHash('sha256').update(reportJson).digest('hex').slice(0, 52);

  const ipfsDisabled = process.env['IPFS_DISABLED'] === 'true';
  const token = process.env['WEB3_STORAGE_TOKEN'];

  if (ipfsDisabled) {
    logger.warn({ cid: mockCid }, 'IPFS disabled — round report not published to IPFS');
  } else if (token && token.length > 0) {
    // In production: upload to web3.storage using @web3-storage/w3up-client
    logger.info({ cid: mockCid }, 'Would upload to IPFS in production');
  } else {
    logger.info({ cid: mockCid }, 'IPFS mock: WEB3_STORAGE_TOKEN not set');
  }

  // Sign the CID with the pool wallet to demonstrate signing logic
  // (runs regardless of whether IPFS is disabled — attests to the content hash)
  const ipfsSignature = await poolWallet.signData(mockCid);
  report.agentAttestation.ipfsSignature = ipfsSignature;

  return {
    cid: mockCid,
    url: `https://ipfs.io/ipfs/${mockCid}`,
  };
}
