// BigInt arithmetic only - never floating point for money
// Formula: quadraticScore(creator) = ( Σ isqrt(tipAmount_i) )²
// matchAllocation(creator) = poolBalance × score(creator) / Σ allScores
// Scale factor: 1_000_000n for precision

export interface CreatorContributions {
  id: string;
  contributions: bigint[];
}

export interface AllocationResult {
  creatorId: string;
  score: bigint;
  matchAmount: bigint;
}

export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('isqrt: negative input');
  if (n === 0n) return 0n;
  // Newton's method: integer floor sqrt
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export function computeQuadraticScore(contributions: bigint[]): bigint {
  const sumSqrt = contributions.reduce((acc, c) => acc + isqrt(c), 0n);
  return sumSqrt * sumSqrt;
}

export function computeAllocations(
  creators: CreatorContributions[],
  poolBalance: bigint
): AllocationResult[] {
  if (creators.length === 0) return [];

  // Compute scores
  const scored = creators.map(c => ({
    creatorId: c.id,
    score: computeQuadraticScore(c.contributions),
    directTips: c.contributions.reduce((s, v) => s + v, 0n),
  }));

  const totalScore = scored.reduce((s, c) => s + c.score, 0n);
  if (totalScore === 0n) {
    return scored.map(c => ({ creatorId: c.creatorId, score: c.score, matchAmount: 0n }));
  }

  // Allocate proportionally
  let allocations = scored.map(c => ({
    creatorId: c.creatorId,
    score: c.score,
    matchAmount: (poolBalance * c.score) / totalScore,
    directTips: c.directTips,
  }));

  // Apply 3× cap per creator
  allocations = allocations.map(a => ({
    ...a,
    matchAmount: a.matchAmount > a.directTips * 3n ? a.directTips * 3n : a.matchAmount,
  }));

  // Ensure total never exceeds pool
  const total = allocations.reduce((s, a) => s + a.matchAmount, 0n);
  if (total > poolBalance) {
    allocations = allocations.map(a => ({
      ...a,
      matchAmount: (a.matchAmount * poolBalance) / total,
    }));
  }

  return allocations.map(({ creatorId, score, matchAmount }) => ({ creatorId, score, matchAmount }));
}
