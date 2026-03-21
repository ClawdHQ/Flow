import { Context } from 'grammy';
import { TipsRepository } from '../../storage/repositories/tips.js';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { computeQuadraticScore } from '../../quadratic/index.js';
import { baseUnitsToUsdt } from '../../utils/math.js';

const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const creatorsRepo = new CreatorsRepository();

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

  const tips = tipsRepo.findConfirmedByRound(round.id);
  const byCreator = new Map<string, bigint[]>();
  for (const tip of tips) {
    if (!byCreator.has(tip.creator_id)) byCreator.set(tip.creator_id, []);
    byCreator.get(tip.creator_id)!.push(BigInt(tip.effective_amount));
  }

  const scored = Array.from(byCreator.entries())
    .map(([id, contribs]) => ({ id, score: computeQuadraticScore(contribs), total: contribs.reduce((s, v) => s + v, 0n) }))
    .sort((a, b) => (b.score > a.score ? 1 : -1))
    .slice(0, 10);

  const lines = ['🏆 **Leaderboard** (Round ' + round.round_number + ')\n'];
  scored.forEach((entry, i) => {
    const creator = creatorsRepo.findById(entry.id);
    lines.push(`${i + 1}. @${creator?.username ?? 'unknown'} — ${baseUnitsToUsdt(entry.total)} USDT (score: ${entry.score})`);
  });

  if (scored.length === 0) lines.push('No confirmed tips yet.');
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
