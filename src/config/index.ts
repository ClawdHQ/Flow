import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
dotenv.config({ path: path.join(projectRoot, '.env') });

const envBoolean = z.preprocess(value => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const baseSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().optional().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().optional().default('anthropic/claude-sonnet-4'),
  ADMIN_TELEGRAM_ID: z.string().optional(),
  WDK_SEED_PHRASE: z.string().min(1),
  WDK_ENCRYPTION_KEY: z.string().min(32),
  FLOW_PUBLIC_BASE_URL: z.string().url().optional().default('http://localhost:3000'),
  MOONPAY_API_KEY: z.string().optional(),
  MOONPAY_SECRET_KEY: z.string().optional(),
  MOONPAY_CACHE_TIME_MS: z.coerce.number().int().positive().optional(),
  MOONPAY_WIDGET_THEME: z.enum(['dark', 'light']).optional(),
  MOONPAY_WIDGET_COLOR: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  MOONPAY_WIDGET_LANGUAGE: z.string().min(2).max(10).optional(),
  MOONPAY_REDIRECT_URL: z.string().url().optional(),
  DEFAULT_CHAIN: z.string().optional(),
  RUMBLE_WEBHOOK_SECRET: z.string().optional(),
  RUMBLE_API_KEY: z.string().optional(),
  RUMBLE_API_BASE_URL: z.string().url().optional().default('https://rumble.com/api/v1'),
  ETHEREUM_RPC_URL: z.string().url().optional(),
  POLYGON_RPC_URL: z.string().url().optional(),
  ARBITRUM_RPC_URL: z.string().url().optional(),
  AVALANCHE_RPC_URL: z.string().url().optional(),
  CELO_RPC_URL: z.string().url().optional(),
  TRON_RPC_URL: z.string().url().optional(),
  BITCOIN_ELECTRUM_URL: z.string().optional(),
  TON_RPC_URL: z.string().optional(),
  USE_TESTNET: envBoolean.default(false),
  ETHEREUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  ETHEREUM_SEPOLIA_USDT_ADDRESS: z.string().optional(),
  POLYGON_AMOY_RPC_URL: z.string().url().optional(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  AVALANCHE_FUJI_RPC_URL: z.string().url().optional(),
  AVALANCHE_FUJI_USDT_ADDRESS: z.string().optional(),
  CELO_SEPOLIA_RPC_URL: z.string().url().optional(),
  CELO_SEPOLIA_USDT_ADDRESS: z.string().optional(),
  TRON_NILE_RPC_URL: z.string().url().optional(),
  TRON_NILE_USDT_ADDRESS: z.string().optional(),
  POLYGON_AMOY_USDT_ADDRESS: z.string().optional(),
  ARBITRUM_SEPOLIA_USDT_ADDRESS: z.string().optional(),
  BITCOIN_TESTNET_ELECTRUM_URL: z.string().optional(),
  TON_TESTNET_RPC_URL: z.string().optional(),
  TON_USDT_ADDRESS: z.string().optional(),
  TON_TESTNET_USDT_ADDRESS: z.string().optional(),
  XAUT_ENABLED: envBoolean.default(true),
  BTC_ENABLED: envBoolean.default(false),
  USAT_ENABLED: envBoolean.default(true),
  AUTO_TIP_ENABLED: envBoolean.default(true),
  AUTO_TIP_HALF_WATCH: z.coerce.bigint().default(100_000n),
  AUTO_TIP_COMPLETE: z.coerce.bigint().default(250_000n),
  AUTO_TIP_DAILY_BUDGET: z.coerce.bigint().default(5_000_000n),
  SPLIT_CREATOR_BPS: z.coerce.number().int().min(0).max(10000).default(8500),
  SPLIT_POOL_BPS: z.coerce.number().int().min(0).max(10000).default(1000),
  MILESTONE_BONUS_ENABLED: envBoolean.default(true),
  XAUT_USDT_RATE: z.coerce.number().positive().optional(),
  BTC_USDT_RATE: z.coerce.number().positive().optional(),
  TOKEN_PRICE_CACHE_MS: z.coerce.number().int().positive().default(60_000),
  COINGECKO_BASE_URL: z.string().url().optional().default('https://api.coingecko.com/api/v3'),
  WDK_PRICE_RATES_API_URL: z.string().url().optional().default('https://wdk-api.tether.io/price-rates'),
  WDK_INDEXER_API_URL: z.string().url().optional().default('https://wdk-api.tether.io'),
  FLOW_ENABLE_LIVE_BTC_WALLET: envBoolean.default(false),
  FLOW_ENABLE_LIVE_TON_WALLET: envBoolean.default(false),
  FLOW_ENABLE_LIVE_TRON_GASFREE: envBoolean.default(false),
  FLOW_ENABLE_LIVE_ERC4337: envBoolean.default(false),
  FLOW_ENABLE_LIVE_USDT0_BRIDGE: envBoolean.default(false),
  FLOW_ENABLE_LIVE_INDEXER: envBoolean.default(false),
  FLOW_ENABLE_LIVE_PRICE_RATES: envBoolean.default(false),
  FLOW_X402_SHARED_SECRET: z.string().optional(),
  WEB3_STORAGE_TOKEN: z.string().optional(),
  IPFS_DISABLED: envBoolean.default(false),
  ROUND_DURATION_HOURS: z.coerce.number().positive().default(24),
  ROUND_CRON: z.string().default('0 0 * * *'),
  MATCHING_POOL_MINIMUM: z.coerce.number().positive().default(500),
  MATCHING_POOL_BOOST_THRESHOLD: z.coerce.number().positive().default(5000),
  SYBIL_WEIGHT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  PROTOCOL_FEE_BPS: z.coerce.number().int().min(0).default(100),
  DB_PATH: z.string().default('./flow.db'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),
  DASHBOARD_SECRET: z.string().optional(),
  AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
});

const configSchema = baseSchema.superRefine((data, ctx) => {
  if (!data.ANTHROPIC_API_KEY && !data.OPENROUTER_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Either ANTHROPIC_API_KEY or OPENROUTER_API_KEY must be set. ' +
        'Get an OpenRouter key (free tier available) at https://openrouter.ai/keys',
      path: ['ANTHROPIC_API_KEY'],
    });
  }
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Configuration error: ${result.error.message}`);
  }
  return result.data;
}

let _config: Config | null = null;

export const config: Config = new Proxy({} as Config, {
  get(_target, prop: string) {
    if (!_config) {
      try {
        _config = loadConfig();
      } catch {
        // Return defaults for testing
        return (baseSchema.shape as Record<string, z.ZodTypeAny>)[prop]?.parse(undefined);
      }
    }
    return (_config as Record<string, unknown>)[prop];
  }
});
