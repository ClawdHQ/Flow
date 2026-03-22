import { Context } from 'grammy';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { RumbleCreatorLinksRepository } from '../../storage/repositories/rumble-creator-links.js';
import { RumbleEventsRepository } from '../../storage/repositories/rumble-events.js';
import { TipsRepository } from '../../storage/repositories/tips.js';
import { baseUnitsToUsdt } from '../../utils/math.js';
import { rumbleClient } from '../../rumble/client.js';

const creatorsRepo = new CreatorsRepository();
const roundsRepo = new RoundsRepository();
const rumbleCreatorLinksRepo = new RumbleCreatorLinksRepository();
const rumbleEventsRepo = new RumbleEventsRepository();
const tipsRepo = new TipsRepository();

export async function handleRumble(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const action = parts[1]?.toLowerCase() ?? 'status';
  const telegramId = String(ctx.from?.id ?? '');
  const creator = creatorsRepo.findByTelegramId(telegramId);

  if (action === 'connect') {
    if (!creator) {
      await ctx.reply('❌ Register first with /register so FLOW has a payout profile to link to Rumble.');
      return;
    }
    const handle = parts[2];
    if (!handle) {
      await ctx.reply('Usage: /rumble connect <rumble_handle>');
      return;
    }
    const metadata = await rumbleClient.getCreator(handle.replace('@', ''));
    const link = rumbleCreatorLinksRepo.linkCreator(metadata.id, metadata.handle, creator.id);
    await ctx.reply(
      `✅ Rumble linked.\n\n` +
      `Handle: @${link.rumble_handle}\n` +
      `Rumble creator id: \`${link.rumble_creator_id}\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (!creator) {
    await ctx.reply('❌ Register first with /register to manage a linked Rumble profile.');
    return;
  }

  const link = rumbleCreatorLinksRepo.findByCreatorId(creator.id);
  if (!link) {
    await ctx.reply('❌ No Rumble profile linked yet. Use /rumble connect <rumble_handle>.');
    return;
  }

  if (action === 'status') {
    const round = roundsRepo.findCurrent();
    const roundTips = round ? tipsRepo.findByCreatorAndRound(creator.id, round.id) : [];
    const autoTips = roundTips.filter(tip => tip.source === 'auto_watch');
    const autoTipTotal = autoTips.reduce((sum, tip) => sum + BigInt(tip.amount_usdt), 0n);
    const recentEvents = rumbleEventsRepo.listRecentByCreator(link.rumble_creator_id, 5);
    await ctx.reply(
      `📺 **Rumble Status**\n\n` +
      `Handle: @${link.rumble_handle}\n` +
      `Rumble creator id: \`${link.rumble_creator_id}\`\n` +
      `Auto-tips this round: ${autoTips.length}\n` +
      `Auto-tip value this round: ${baseUnitsToUsdt(autoTipTotal)} USD₮\n` +
      `Recent events seen: ${recentEvents.length}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (action === 'events') {
    const requested = parts[2] ? Number.parseInt(parts[2], 10) : 10;
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 20) : 10;
    const events = rumbleEventsRepo.listRecentByCreator(link.rumble_creator_id, limit);
    if (events.length === 0) {
      await ctx.reply('No Rumble events recorded for this creator yet.');
      return;
    }
    const lines = events.map(event => `• ${event.event_type} — ${event.created_at}${event.video_title ? ` — ${event.video_title}` : ''}`);
    await ctx.reply(`📺 **Recent Rumble Events**\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    return;
  }

  await ctx.reply('Usage:\n/rumble connect <rumble_handle>\n/rumble status\n/rumble events [limit]');
}
