import { Context } from 'grammy';
import { getChainDisplayName } from '../../config/chains.js';
import { getPoolSnapshot } from '../../dashboard/data.js';

export async function handlePool(ctx: Context): Promise<void> {
  const report = await getPoolSnapshot();
  const breakdown = report.chainBalances
    .map(pool => `• ${getChainDisplayName(pool.chain)}: ${pool.balance} USD₮`)
    .join('\n');
  await ctx.reply(
    `💰 **Pool Health Report**\n\n` +
    `Balance: ${report.balance} USD₮\n` +
    `By chain:\n${breakdown}\n` +
    `Multiplier: ${report.multiplier}x\n` +
    `Projected usage: ${report.projectedPoolUsage} USD₮/round\n` +
    `Rounds until depletion: ${report.roundsUntilDepletion}\n` +
    `Total distributed: ${report.totalDistributed} USD₮`,
    { parse_mode: 'Markdown' }
  );
}
