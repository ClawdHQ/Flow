import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsdt(baseUnits: string | bigint): string {
  let value: bigint;
  if (typeof baseUnits === 'bigint') {
    value = baseUnits;
  } else {
    const s = (baseUnits ?? '').trim();
    if (!s) {
      value = 0n;
    } else if (s.includes('.')) {
      // Decimal / display-format string — convert to base units
      value = BigInt(Math.round(parseFloat(s) * 1_000_000));
    } else {
      value = BigInt(s);
    }
  }
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function formatUsdtDisplay(baseUnits: string | bigint): string {
  const formatted = formatUsdt(baseUnits);
  return `$${formatted}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = Date.parse(dateStr);
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
