import { Context } from 'grammy';
import { TipsRepository } from '../../storage/repositories/tips.js';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { baseUnitsToUsdt } from '../../utils/math.js';

const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const creatorsRepo = new CreatorsRepository();

export async function handleHistory(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const target = parts[1]?.replace('@', '');
  const roundCount = parseInt(parts[2] ?? '5', 10);

  const telegramId = String(ctx.from?.id ?? '');
  const rounds = roundsRepo.findAll(roundCount);

  const lines: string[] = ['📜 **Tip History**\n'];
  for (const round of rounds) {
    const tips = target
      ? (creatorsRepo.findByUsername(target)
        ? tipsRepo.findByCreatorAndRound(creatorsRepo.findByUsername(target)!.id, round.id)
        : [])
      : tipsRepo.findByTipperAndRound(telegramId, round.id);

    if (tips.length === 0) continue;
    lines.push(`\n**Round ${round.round_number}** (${round.status})`);
    for (const tip of tips) {
      lines.push(`• ${baseUnitsToUsdt(BigInt(tip.amount_usdt))} USDT → ${tip.status}`);
    }
  }

  if (lines.length === 1) lines.push('No tips found.');
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
