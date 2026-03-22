import { Context } from 'grammy';
import { getRecentRoundSnapshots } from '../../dashboard/data.js';

export async function handleRounds(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const requestedLimit = parts[1] ? parseInt(parts[1], 10) : 10;
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 10;
  const rounds = getRecentRoundSnapshots(limit);

  if (rounds.length === 0) {
    await ctx.reply('🕘 No rounds found yet.');
    return;
  }

  const lines = ['🕘 **Recent Rounds**\n'];
  rounds.forEach(round => {
    lines.push(
      `• Round ${round.round_number} — ${round.status} — direct ${round.total_direct_tips} USD₮ — matched ${round.total_matched} USD₮ — tippers ${round.tipper_count}`
    );
  });

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
