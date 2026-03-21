import { Context } from 'grammy';
import { PoolMonitor } from '../../agent/pool-monitor.js';
import { baseUnitsToUsdt } from '../../utils/math.js';

const poolMonitor = new PoolMonitor();

export async function handlePool(ctx: Context): Promise<void> {
  const report = await poolMonitor.generatePoolReport();
  await ctx.reply(
    `💰 **Pool Health Report**\n\n` +
    `Balance: ${baseUnitsToUsdt(report.balance)} USDT\n` +
    `Multiplier: ${report.multiplier}x\n` +
    `Projected usage: ${baseUnitsToUsdt(report.projectedPoolUsage)} USDT/round\n` +
    `Rounds until depletion: ${report.roundsUntilDepletion}\n` +
    `Total distributed: ${baseUnitsToUsdt(report.totalDistributedAllTime)} USDT`,
    { parse_mode: 'Markdown' }
  );
}
