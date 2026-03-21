import { describe, it, expect } from 'vitest';
import { isqrt, computeQuadraticScore, computeAllocations } from '../src/quadratic/index.js';

describe('isqrt', () => {
  it.each([
    [0n, 0n],
    [1n, 1n],
    [2n, 1n],
    [3n, 1n],
    [4n, 2n],
    [9n, 3n],
    [16n, 4n],
    [25n, 5n],
    [100n, 10n],
    [1_000_000n, 1000n],
  ])('isqrt(%s) === %s', (input, expected) => {
    expect(isqrt(input)).toBe(expected);
  });
});

describe('quadratic funding', () => {
  it('100 tippers × 1 USDT beats 1 tipper × 100 USDT', () => {
    const manySmall = computeQuadraticScore(Array(100).fill(1_000_000n));
    const oneLarge = computeQuadraticScore([100_000_000n]);
    expect(manySmall).toBeGreaterThan(oneLarge);
  });

  it('pool allocations never exceed pool balance', () => {
    const creators = [
      { id: 'a', contributions: [5_000_000n, 3_000_000n] },
      { id: 'b', contributions: [1_000_000n, 1_000_000n, 1_000_000n] },
    ];
    const pool = 1_000_000_000n;
    const allocs = computeAllocations(creators, pool);
    const total = allocs.reduce((s, a) => s + a.matchAmount, 0n);
    expect(total).toBeLessThanOrEqual(pool);
  });

  it('3× cap: no creator receives more than 3× direct tips in matching', () => {
    const creators = [{ id: 'a', contributions: [1_000_000n] }];
    const pool = 100_000_000_000n;
    const allocs = computeAllocations(creators, pool);
    const directTips = 1_000_000n;
    expect(allocs[0]!.matchAmount).toBeLessThanOrEqual(directTips * 3n);
  });

  it('empty round: zero allocations, pool unchanged', () => {
    const allocs = computeAllocations([], 1_000_000_000n);
    expect(allocs).toHaveLength(0);
  });

  it('single creator: gets pool capped at 3× direct tips', () => {
    const directTip = 5_000_000n;
    const creators = [{ id: 'a', contributions: [directTip] }];
    const pool = 100_000_000n;
    const allocs = computeAllocations(creators, pool);
    expect(allocs[0]!.matchAmount).toBeLessThanOrEqual(directTip * 3n);
  });
});
