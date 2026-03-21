import { Bot } from 'grammy';
import { loggerMiddleware } from './middleware/logger.js';
import { rateLimiter } from './middleware/auth.js';
import { handleRegister } from './commands/register.js';
import { handleTip } from './commands/tip.js';
import { handlePool } from './commands/pool.js';
import { handleHistory } from './commands/history.js';
import { handleWithdraw } from './commands/withdraw.js';
import { handleLeaderboard } from './commands/leaderboard.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { logger } from '../utils/logger.js';

const roundsRepo = new RoundsRepository();

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.use(loggerMiddleware);
  bot.use(rateLimiter);

  bot.command('register', handleRegister);
  bot.command('tip', handleTip);
  bot.command('pool', handlePool);
  bot.command('history', handleHistory);
  bot.command('withdraw', handleWithdraw);
  bot.command('leaderboard', handleLeaderboard);

  bot.command('status', async ctx => {
    const round = roundsRepo.findCurrent();
    await ctx.reply(
      `🤖 **FLOW Status**\n\n` +
      `Round: ${round?.round_number ?? 'none'}\n` +
      `Status: ${round?.status ?? 'idle'}\n` +
      `Tips: ${round ? String(round.tipper_count) : '0'}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('start', async ctx => {
    await ctx.reply(
      `👋 Welcome to FLOW — Quadratic Tipping!\n\n` +
      `Commands:\n` +
      `/register <wallet> [chain] — Register as creator\n` +
      `/tip @username <amount> [msg] — Send a tip\n` +
      `/pool — Pool health\n` +
      `/leaderboard — Current standings\n` +
      `/history — Your tip history\n` +
      `/withdraw — Withdraw earnings`
    );
  });

  bot.catch(err => {
    logger.error({ err }, 'Bot error');
  });

  return bot;
}
