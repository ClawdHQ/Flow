import { Context } from 'grammy';
import { getCurrentRoundSnapshot } from '../../dashboard/data.js';

export async function handleRound(ctx: Context): Promise<void> {
  const round = getCurrentRoundSnapshot();

  if (!round) {
    await ctx.reply('📊 No active round right now.');
    return;
  }

  await ctx.reply(
    `📊 **Current Round**\n\n` +
      `Round: #${round.round_number}\n` +
      `Status: ${round.status}\n` +
      `Multiplier: ${round.matching_multiplier}x\n` +
      `Direct tips: ${round.total_direct_tips} USD₮\n` +
      `Matched: ${round.total_matched} USD₮\n` +
      `Tippers: ${round.tipper_count}\n` +
      `Creators: ${round.creator_count}\n` +
      `Sybil flags: ${round.sybil_flags_count}\n` +
      `Started: ${round.started_at}`,
    { parse_mode: 'Markdown' }
  );
}
