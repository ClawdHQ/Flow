/**
 * FLOW Telegram Bot — command wiring and bot factory.
 *
 * OpenClaw compatibility: FLOW exposes its core agent functions as
 * OpenClaw-compatible skills. See src/openclaw-skill.md for the skill
 * definition that OpenClaw agents can load for file-based instructions.
 */
import { Bot } from 'grammy';
import { loggerMiddleware } from './middleware/logger.js';
import { rateLimiter } from './middleware/auth.js';
import { handleRegister } from './commands/register.js';
import { handleTip } from './commands/tip.js';
import { handlePool } from './commands/pool.js';
import { handleDeposit } from './commands/deposit.js';
import { handleBalance } from './commands/balance.js';
import { handleHistory } from './commands/history.js';
import { handleWithdraw } from './commands/withdraw.js';
import { handleLeaderboard } from './commands/leaderboard.js';
import { handleRound } from './commands/round.js';
import { handleSybil } from './commands/sybil.js';
import { handleRounds } from './commands/rounds.js';
import { handleFiat } from './commands/fiat.js';
import { handleBuy } from './commands/buy.js';
import { handleSell } from './commands/sell.js';
import { getDefaultChain } from '../config/chains.js';
import { getCurrentRoundSnapshot } from '../dashboard/data.js';
import { logger } from '../utils/logger.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.use(loggerMiddleware);
  bot.use(rateLimiter);

  bot.command('register', handleRegister);
  bot.command('tip', handleTip);
  bot.command('deposit', handleDeposit);
  bot.command('balance', handleBalance);
  bot.command('pool', handlePool);
  bot.command('round', handleRound);
  bot.command('rounds', handleRounds);
  bot.command('history', handleHistory);
  bot.command('withdraw', handleWithdraw);
  bot.command('leaderboard', handleLeaderboard);
  bot.command('sybil', handleSybil);
  bot.command('fiat', handleFiat);
  bot.command('buy', handleBuy);
  bot.command('sell', handleSell);

  bot.command('status', async ctx => {
    const adminId = process.env['ADMIN_TELEGRAM_ID'];
    if (adminId && ctx.from?.id.toString() !== adminId) {
      await ctx.reply('⛔ This command is restricted to the bot administrator.');
      return;
    }
    const round = getCurrentRoundSnapshot();
    await ctx.reply(
      `🤖 **FLOW Status**\n\n` +
      `Round: ${round?.round_number ?? 'none'}\n` +
      `Status: ${round?.status ?? 'idle'}\n` +
      `Tippers: ${round ? String(round.tipper_count) : '0'}\n` +
      `Creators: ${round ? String(round.creator_count) : '0'}\n` +
      `Sybil flags: ${round ? String(round.sybil_flags_count) : '0'}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('start', async ctx => {
    const defaultChain = getDefaultChain();
    await ctx.reply(
      `👋 Welcome to FLOW — Quadratic Tipping!\n\n` +
      `Commands:\n` +
      `/register <wallet> [chain] — Register as creator (default: ${defaultChain})\n` +
      `/tip @username <amount> [msg] — Send a tip\n` +
      `/deposit — Get your deposit wallet\n` +
      `/balance — Check your accumulated balance\n` +
      `/pool — Pool health\n` +
      `/round — Current round metrics\n` +
      `/rounds [limit] — Recent rounds\n` +
      `/leaderboard — Current standings\n` +
      `/sybil — Current sybil flags\n` +
      `/history — Your tip history\n` +
      `/withdraw — Withdraw earnings\n` +
      `/fiat — MoonPay fiat commands\n` +
      `/buy — MoonPay buy link\n` +
      `/sell — MoonPay sell link`
    );
  });

  bot.catch(err => {
    logger.error({ err }, 'Bot error');
  });

  return bot;
}
