export const USDT_DECIMALS = 6n;
export const USDT_SCALE = 1_000_000n;

export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('Square root of negative number');
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export function usdtToBaseUnits(usdt: string): bigint {
  const [whole = '0', frac = ''] = usdt.split('.');
  const fracPadded = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(whole) * USDT_SCALE + BigInt(fracPadded);
}

export function baseUnitsToUsdt(units: bigint): string {
  const whole = units / USDT_SCALE;
  const frac = (units % USDT_SCALE).toString().padStart(6, '0');
  return `${whole}.${frac}`;
}

export function percentOf(amount: bigint, bps: bigint): bigint {
  return (amount * bps) / 10000n;
}
