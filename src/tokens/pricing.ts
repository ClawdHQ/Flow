import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { SupportedToken } from './index.js';
import { RateSnapshotsRepository } from '../storage/repositories/rate-snapshots.js';

interface TokenPriceCacheEntry {
  rate: bigint;
  fetchedAt: number;
  snapshotId?: string;
}

interface NormalizedAmountResult {
  normalizedAmount: bigint;
  rate: bigint;
  snapshotId?: string;
  source: 'wdk_price_rates' | 'config_override' | 'demo_static';
}

const tokenPriceCache = new Map<SupportedToken, TokenPriceCacheEntry>();
const rateSnapshotsRepo = new RateSnapshotsRepository();
const USDT_SCALE = 1_000_000n;

function decimalToBaseUnits(value: number | string): bigint {
  const numeric = typeof value === 'number' ? value.toFixed(6) : value;
  const [whole = '0', frac = '0'] = numeric.split('.');
  return BigInt(whole) * USDT_SCALE + BigInt(frac.padEnd(6, '0').slice(0, 6));
}

function getConfiguredRate(token: SupportedToken): bigint | null {
  if (token === 'USDT' || token === 'USAT') {
    return USDT_SCALE;
  }
  if (token === 'XAUT' && config.XAUT_USDT_RATE) {
    return decimalToBaseUnits(config.XAUT_USDT_RATE);
  }
  if (token === 'BTC' && config.BTC_USDT_RATE) {
    return decimalToBaseUnits(config.BTC_USDT_RATE);
  }
  return null;
}

async function fetchWdkRate(token: SupportedToken): Promise<bigint | null> {
  if (!config.FLOW_ENABLE_LIVE_PRICE_RATES) {
    return null;
  }

  const response = await fetch(
    `${config.WDK_PRICE_RATES_API_URL}?base=${encodeURIComponent(token)}&quote=USDT`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) {
    throw new Error(`WDK Price Rates request failed with ${response.status}`);
  }

  const data = await response.json() as {
    rate?: number | string;
    data?: { rate?: number | string };
  };
  const rate = data.rate ?? data.data?.rate;
  if (!rate) {
    return null;
  }
  return decimalToBaseUnits(rate);
}

function createSnapshot(token: SupportedToken, rate: bigint, source: NormalizedAmountResult['source']): string {
  return rateSnapshotsRepo.create({
    token,
    quoteToken: 'USDT',
    rate: rate.toString(),
    source,
    capturedAt: new Date().toISOString(),
  }).id;
}

async function resolveRate(token: SupportedToken): Promise<NormalizedAmountResult> {
  const configured = getConfiguredRate(token);
  if (configured) {
    const snapshotId = createSnapshot(
      token,
      configured,
      token === 'USDT' || token === 'USAT' ? 'demo_static' : 'config_override',
    );
    tokenPriceCache.set(token, { rate: configured, fetchedAt: Date.now(), snapshotId });
    return {
      normalizedAmount: 0n,
      rate: configured,
      snapshotId,
      source: token === 'USDT' || token === 'USAT' ? 'demo_static' : 'config_override',
    };
  }

  const cached = tokenPriceCache.get(token);
  if (cached && Date.now() - cached.fetchedAt < config.TOKEN_PRICE_CACHE_MS) {
    return {
      normalizedAmount: 0n,
      rate: cached.rate,
      snapshotId: cached.snapshotId,
      source: 'wdk_price_rates',
    };
  }

  try {
    const live = await fetchWdkRate(token);
    if (live) {
      const snapshotId = createSnapshot(token, live, 'wdk_price_rates');
      tokenPriceCache.set(token, { rate: live, fetchedAt: Date.now(), snapshotId });
      return {
        normalizedAmount: 0n,
        rate: live,
        snapshotId,
        source: 'wdk_price_rates',
      };
    }
  } catch (err) {
    logger.warn({ err, token }, 'WDK Price Rates fetch failed, using cached or static fallback');
  }

  if (cached) {
    return {
      normalizedAmount: 0n,
      rate: cached.rate,
      snapshotId: cached.snapshotId,
      source: 'wdk_price_rates',
    };
  }

  const demoRate = token === 'BTC' ? 100_000n * USDT_SCALE : 3_000n * USDT_SCALE;
  const snapshotId = createSnapshot(token, demoRate, 'demo_static');
  tokenPriceCache.set(token, { rate: demoRate, fetchedAt: Date.now(), snapshotId });
  return {
    normalizedAmount: 0n,
    rate: demoRate,
    snapshotId,
    source: 'demo_static',
  };
}

export async function getTokenRateInUsdtBase(token: SupportedToken): Promise<bigint> {
  const rate = await resolveRate(token);
  return rate.rate;
}

export async function normalizeTokenAmountWithSnapshot(amount: bigint, token: SupportedToken): Promise<NormalizedAmountResult> {
  const rateResult = await resolveRate(token);
  if (token === 'USDT' || token === 'USAT') {
    return {
      normalizedAmount: amount,
      rate: rateResult.rate,
      snapshotId: rateResult.snapshotId,
      source: rateResult.source,
    };
  }

  const decimals = token === 'BTC' ? 8n : 6n;
  const scale = 10n ** decimals;
  return {
    normalizedAmount: (amount * rateResult.rate) / scale,
    rate: rateResult.rate,
    snapshotId: rateResult.snapshotId,
    source: rateResult.source,
  };
}

export async function normalizeTokenAmountToUsdtBase(amount: bigint, token: SupportedToken): Promise<bigint> {
  const normalized = await normalizeTokenAmountWithSnapshot(amount, token);
  return normalized.normalizedAmount;
}
