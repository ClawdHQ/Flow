import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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
  POLYGON_RPC_URL: z.string().url().optional(),
  ARBITRUM_RPC_URL: z.string().url().optional(),
  TRON_RPC_URL: z.string().url().optional(),
  USE_TESTNET: z.coerce.boolean().default(false),
  POLYGON_AMOY_RPC_URL: z.string().url().optional(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  WEB3_STORAGE_TOKEN: z.string().optional(),
  IPFS_DISABLED: z.coerce.boolean().default(false),
  ROUND_DURATION_HOURS: z.coerce.number().positive().default(24),
  ROUND_CRON: z.string().default('0 0 * * *'),
  MATCHING_POOL_MINIMUM: z.coerce.number().positive().default(500),
  MATCHING_POOL_BOOST_THRESHOLD: z.coerce.number().positive().default(5000),
  SYBIL_WEIGHT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  PROTOCOL_FEE_BPS: z.coerce.number().int().min(0).default(100),
  DB_PATH: z.string().default('./flow.db'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),
  DASHBOARD_SECRET: z.string().optional(),
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
