import { Context } from 'grammy';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { getRoundLeaderboardSnapshot } from '../../dashboard/data.js';

const roundsRepo = new RoundsRepository();

export async function handleLeaderboard(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const roundNum = parts[1] ? parseInt(parts[1], 10) : undefined;

  const round = roundNum
    ? roundsRepo.findAll().find(r => r.round_number === roundNum)
    : roundsRepo.findCurrent() ?? roundsRepo.findLatestCompleted();

  if (!round) {
    await ctx.reply('❌ No round found.');
    return;
  }

  const scored = getRoundLeaderboardSnapshot(round)
    .slice(0, 10);

  const lines = ['🏆 **Leaderboard** (Round ' + round.round_number + ')\n'];
  scored.forEach((entry, i) => {
    lines.push(`${i + 1}. @${entry.creator} — ${entry.total} USD₮ (score: ${entry.score})`);
  });

  if (scored.length === 0) lines.push('No confirmed tips yet.');
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
