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
import { handleAutotip } from './commands/autotip.js';
import { handleWithdraw } from './commands/withdraw.js';
import { handleLeaderboard } from './commands/leaderboard.js';
import { handleRound } from './commands/round.js';
import { handleSybil } from './commands/sybil.js';
import { handleRounds } from './commands/rounds.js';
import { handleRumble } from './commands/rumble.js';
import { handleFiat } from './commands/fiat.js';
import { handleBuy } from './commands/buy.js';
import { handleSell } from './commands/sell.js';
import { handleSplit } from './commands/split.js';
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
  bot.command('autotip', handleAutotip);
  bot.command('pool', handlePool);
  bot.command('round', handleRound);
  bot.command('rounds', handleRounds);
  bot.command('history', handleHistory);
  bot.command('rumble', handleRumble);
  bot.command('split', handleSplit);
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
      `🤖 **FLOW × Rumble Status**\n\n` +
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
      `🌊 **FLOW — Quadratic Tipping Agent on Rumble**\n\n` +
      `Flow turns Rumble watch-time, milestones, and direct tips into programmable community support.\n\n` +
      `Core:\n` +
      `/register <wallet> [chain] — Link your FLOW payout profile (default: ${defaultChain})\n` +
      `/rumble connect <handle> — Link your Rumble creator identity\n` +
      `/tip @username <amount> [msg] — Send a manual community tip\n` +
      `/deposit — Show your creator deposit wallet\n` +
      `/balance — Show your creator wallet balance\n\n` +
      `Automation:\n` +
      `/autotip [on|off] [budget] [token] — Configure viewer auto-tip rules\n` +
      `/split — Configure creator / collaborator / pool splits\n` +
      `/pool — Pool health and multiplier\n` +
      `/round — Current round snapshot\n` +
      `/rounds [limit] — Recent rounds\n` +
      `/leaderboard — Quadratic score leaderboard\n` +
      `/sybil — Current sybil flags\n` +
      `/history — Your tip history\n` +
      `/status — Admin runtime status\n\n` +
      `Fiat:\n` +
      `/fiat — MoonPay capabilities\n` +
      `/buy — On-ramp link\n` +
      `/sell — Off-ramp link\n\n` +
      `Creator ops:\n` +
      `/withdraw — Withdraw creator funds\n` +
      `/rumble status — Linked handle and recent activity\n` +
      `/rumble events [limit] — Recent Rumble events`
      ,
      { parse_mode: 'Markdown' }
    );
  });

  bot.catch(err => {
    logger.error({ err }, 'Bot error');
  });

  return bot;
}
