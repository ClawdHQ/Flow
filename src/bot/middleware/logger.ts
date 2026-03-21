import { Context, NextFunction } from 'grammy';
import { logger } from '../../utils/logger.js';

export async function loggerMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const start = Date.now();
  logger.info({
    from: ctx.from?.id,
    username: ctx.from?.username,
    text: ctx.message?.text,
  }, 'Incoming update');
  await next();
  logger.info({ ms: Date.now() - start }, 'Update processed');
}
