import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { SupportedToken } from './index.js';

const COINGECKO_IDS: Partial<Record<SupportedToken, string>> = {
  XAUT: 'tether-gold',
  BTC: 'bitcoin',
};

interface TokenPriceCacheEntry {
  rate: bigint;
  fetchedAt: number;
}

const tokenPriceCache = new Map<SupportedToken, TokenPriceCacheEntry>();
const USDT_SCALE = 1_000_000n;

function decimalToBaseUnits(value: number): bigint {
  const fixed = value.toFixed(6);
  const [whole = '0', frac = '0'] = fixed.split('.');
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

async function fetchLiveRate(token: SupportedToken): Promise<bigint | null> {
  const coinId = COINGECKO_IDS[token];
  if (!coinId) {
    return getConfiguredRate(token);
  }
  const response = await fetch(
    `${config.COINGECKO_BASE_URL}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) {
    throw new Error(`CoinGecko price request failed with ${response.status}`);
  }
  const data = await response.json() as Record<string, { usd?: number }>;
  const usd = data[coinId]?.usd;
  if (!usd || !Number.isFinite(usd) || usd <= 0) {
    return null;
  }
  return decimalToBaseUnits(usd);
}

export async function getTokenRateInUsdtBase(token: SupportedToken): Promise<bigint> {
  const configured = getConfiguredRate(token);
  if (configured) {
    tokenPriceCache.set(token, { rate: configured, fetchedAt: Date.now() });
    return configured;
  }

  const cached = tokenPriceCache.get(token);
  if (cached && Date.now() - cached.fetchedAt < config.TOKEN_PRICE_CACHE_MS) {
    return cached.rate;
  }

  try {
    const live = await fetchLiveRate(token);
    if (live) {
      tokenPriceCache.set(token, { rate: live, fetchedAt: Date.now() });
      return live;
    }
  } catch (err) {
    logger.warn({ err, token }, 'Token price fetch failed, using cached fallback if available');
  }

  if (cached) {
    return cached.rate;
  }

  return token === 'BTC' ? 100_000n * USDT_SCALE : USDT_SCALE;
}

export async function normalizeTokenAmountToUsdtBase(amount: bigint, token: SupportedToken): Promise<bigint> {
  if (token === 'USDT' || token === 'USAT') {
    return amount;
  }

  const decimals = token === 'BTC' ? 8n : 6n;
  const scale = 10n ** decimals;
  const rate = await getTokenRateInUsdtBase(token);
  return (amount * rate) / scale;
}
