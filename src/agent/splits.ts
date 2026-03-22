import { config } from '../config/index.js';
import { percentOf } from '../utils/math.js';

export interface SplitCollaborator {
  address: string;
  chain: string;
  bps: number;
}

export interface SplitConfig {
  creatorId: string;
  creatorBps: number;
  poolBps: number;
  protocolBps: number;
  collaborators?: SplitCollaborator[];
}

export interface SplitBreakdown {
  creatorAmount: bigint;
  poolAmount: bigint;
  protocolAmount: bigint;
  collaboratorAmounts: Array<SplitCollaborator & { amount: bigint }>;
  reservedAmount: bigint;
}

export function getDefaultSplitConfig(creatorId: string): SplitConfig {
  return {
    creatorId,
    creatorBps: config.SPLIT_CREATOR_BPS,
    poolBps: config.SPLIT_POOL_BPS,
    protocolBps: config.PROTOCOL_FEE_BPS,
    collaborators: [],
  };
}

export function validateSplitConfig(split: SplitConfig): void {
  const collaboratorBps = (split.collaborators ?? []).reduce((sum, collaborator) => sum + collaborator.bps, 0);
  const total = split.creatorBps + split.poolBps + split.protocolBps + collaboratorBps;
  if (total > 10_000) {
    throw new Error('Split basis points cannot exceed 10000.');
  }
}

export function computeSplitBreakdown(amount: bigint, split: SplitConfig): SplitBreakdown {
  validateSplitConfig(split);
  const creatorAmount = percentOf(amount, BigInt(split.creatorBps));
  const poolAmount = percentOf(amount, BigInt(split.poolBps));
  const protocolAmount = percentOf(amount, BigInt(split.protocolBps));
  const collaboratorAmounts = (split.collaborators ?? []).map(collaborator => ({
    ...collaborator,
    amount: percentOf(amount, BigInt(collaborator.bps)),
  }));
  const distributed = collaboratorAmounts.reduce(
    (sum, collaborator) => sum + collaborator.amount,
    creatorAmount + poolAmount + protocolAmount,
  );
  return {
    creatorAmount,
    poolAmount,
    protocolAmount,
    collaboratorAmounts,
    reservedAmount: amount - distributed,
  };
}
