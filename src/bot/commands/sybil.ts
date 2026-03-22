import { Context } from 'grammy';
import { getCurrentRoundSybilFlags } from '../../dashboard/data.js';

function formatReasons(reasons: string): string {
  try {
    const parsed = JSON.parse(reasons) as unknown;
    return Array.isArray(parsed) ? parsed.join(', ') : reasons;
  } catch {
    return reasons;
  }
}

export async function handleSybil(ctx: Context): Promise<void> {
  const flags = getCurrentRoundSybilFlags();

  if (flags.length === 0) {
    await ctx.reply('🛡️ No sybil flags for the current round.');
    return;
  }

  const lines = ['🛡️ **Current Sybil Flags**\n', `Flagged tips: ${flags.length}`];
  flags.slice(0, 5).forEach((flag, index) => {
    lines.push(
      `\n${index + 1}. score ${flag.flag_score.toFixed(2)} [${flag.method}]`,
      formatReasons(flag.reasons)
    );
  });

  if (flags.length > 5) {
    lines.push(`\nShowing 5 of ${flags.length} flags.`);
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
