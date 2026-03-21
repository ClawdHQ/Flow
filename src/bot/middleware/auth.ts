import { Context, NextFunction } from 'grammy';
import { logger } from '../../utils/logger.js';

const rateLimitMap = new Map<number, { count: number; resetAt: number }>();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000;

export async function rateLimiter(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    await next();
    return;
  }
  if (entry.count >= MAX_REQUESTS) {
    logger.warn({ userId }, 'Rate limit exceeded');
    await ctx.reply('⚠️ Too many requests. Please wait a minute.');
    return;
  }
  entry.count++;
  await next();
}
