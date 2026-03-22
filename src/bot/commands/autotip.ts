import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { AutoTipAgent } from '../../agent/auto-tip.js';
import { AutoTipRulesRepository } from '../../storage/repositories/auto-tip-rules.js';
import { formatAmount, parseAmount, type SupportedToken } from '../../tokens/index.js';
import { getDefaultChain } from '../../config/chains.js';

const autoTipAgent = new AutoTipAgent();
const autoTipRulesRepo = new AutoTipRulesRepository();

function getDefaultRule(viewerId: string): {
  viewerId: string;
  budgetPerDayUsdt: bigint;
  tipOnHalfWatch: bigint;
  tipOnComplete: bigint;
  token: SupportedToken;
  chain: string;
  enabled: boolean;
} {
  return {
    viewerId,
    budgetPerDayUsdt: config.AUTO_TIP_DAILY_BUDGET,
    tipOnHalfWatch: config.AUTO_TIP_HALF_WATCH,
    tipOnComplete: config.AUTO_TIP_COMPLETE,
    token: 'USDT',
    chain: getDefaultChain(),
    enabled: config.AUTO_TIP_ENABLED,
  };
}

export async function handleAutotip(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const action = parts[1]?.toLowerCase();
  const viewerId = String(ctx.from?.id ?? '');
  const existing = autoTipRulesRepo.findByViewerAndCreator(viewerId);
  const current = existing
    ? {
      enabled: existing.enabled === 1,
      budget: BigInt(existing.budget_per_day_base),
      half: BigInt(existing.tip_on_half_watch),
      complete: BigInt(existing.tip_on_complete),
      token: existing.token,
    }
    : {
      enabled: config.AUTO_TIP_ENABLED,
      budget: config.AUTO_TIP_DAILY_BUDGET,
      half: config.AUTO_TIP_HALF_WATCH,
      complete: config.AUTO_TIP_COMPLETE,
      token: 'USDT' as SupportedToken,
    };

  if (!action) {
    const stats = autoTipAgent.getViewerStats(viewerId);
    await ctx.reply(
      `⚙️ **Auto-Tip Status**\n\n` +
      `Status: ${current.enabled ? 'enabled' : 'disabled'}\n` +
      `Daily budget: ${formatAmount(current.budget, current.token)} ${current.token}\n` +
      `50% watch tip: ${formatAmount(current.half, current.token)} ${current.token}\n` +
      `Completion tip: ${formatAmount(current.complete, current.token)} ${current.token}\n` +
      `Today's spend: ${formatAmount(stats.spend, current.token)} ${current.token}\n` +
      `Tips fired today: ${stats.tipCount} across ${stats.creatorCount} creators`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (action !== 'on' && action !== 'off') {
    await ctx.reply('Usage: /autotip [on|off] [budget_per_day] [token]\nExample: /autotip on 5 USDT');
    return;
  }

  const token = (parts[3]?.toUpperCase() ?? current.token) as SupportedToken;
  if (!['USDT', 'XAUT', 'USAT'].includes(token)) {
    await ctx.reply('❌ Supported auto-tip tokens are USDT, XAUT, and USAT. BTC direct auto-tips are not supported yet.');
    return;
  }

  const budgetAmount = parts[2]
    ? parseAmount(parts[2], token)
    : current.budget || getDefaultRule(viewerId).budgetPerDayUsdt;
  const baseRule = getDefaultRule(viewerId);
  autoTipAgent.registerAutoTipRule({
    viewerId,
    budgetPerDayUsdt: budgetAmount,
    tipOnHalfWatch: baseRule.tipOnHalfWatch,
    tipOnComplete: baseRule.tipOnComplete,
    token,
    chain: getDefaultChain(),
    enabled: action === 'on',
  });

  await ctx.reply(
    `✅ Auto-tip ${action === 'on' ? 'enabled' : 'disabled'}.\n\n` +
    `Daily budget: ${formatAmount(budgetAmount, token)} ${token}\n` +
    `50% watch tip: ${formatAmount(baseRule.tipOnHalfWatch, token)} ${token}\n` +
    `Completion tip: ${formatAmount(baseRule.tipOnComplete, token)} ${token}`,
    { parse_mode: 'Markdown' }
  );
}
