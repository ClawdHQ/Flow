import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  WDK_SEED_PHRASE: z.string().min(1),
  WDK_ENCRYPTION_KEY: z.string().min(32),
  POLYGON_RPC_URL: z.string().url(),
  ARBITRUM_RPC_URL: z.string().url(),
  TRON_RPC_URL: z.string().url(),
  WEB3_STORAGE_TOKEN: z.string().min(1),
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
        return (configSchema.shape as Record<string, z.ZodTypeAny>)[prop]?.parse(undefined);
      }
    }
    return (_config as Record<string, unknown>)[prop];
  }
});
