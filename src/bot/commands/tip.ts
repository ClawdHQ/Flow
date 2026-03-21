import { Context } from 'grammy';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { TipsRepository } from '../../storage/repositories/tips.js';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { EscrowWalletManager } from '../../wallet/escrow.js';
import { SybilDetector } from '../../agent/sybil.js';
import { usdtToBaseUnits, baseUnitsToUsdt } from '../../utils/math.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';

const creatorsRepo = new CreatorsRepository();
const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const escrowManager = new EscrowWalletManager();
const sybilDetector = new SybilDetector();

export async function handleTip(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const target = parts[1]?.replace('@', '');
  const amountStr = parts[2];
  const message = parts.slice(3).join(' ');

  if (!target || !amountStr) {
    await ctx.reply('Usage: /tip @username <amount_usdt> [message]\nExample: /tip @alice 5.00 Great content!');
    return;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount < 1) {
    await ctx.reply('❌ Minimum tip amount is 1 USDT.');
    return;
  }

  const creator = creatorsRepo.findByUsername(target);
  if (!creator) {
    await ctx.reply(`❌ @${target} is not registered. They need to run /register first.`);
    return;
  }

  const round = roundsRepo.findCurrent();
  if (!round) {
    await ctx.reply('❌ No active round. Try again later.');
    return;
  }

  const amountBigInt = usdtToBaseUnits(amountStr);
  const escrow = await escrowManager.createForTip(uuidv4(), amountBigInt, creator.preferred_chain);

  const tip = tipsRepo.create({
    tip_uuid: uuidv4(),
    round_id: round.id,
    tipper_telegram_id: String(ctx.from?.id ?? ''),
    creator_id: creator.id,
    amount_usdt: amountBigInt.toString(),
    effective_amount: amountBigInt.toString(),
    chain: creator.preferred_chain,
    escrow_address: escrow.address,
    status: 'pending',
    sybil_weight: 1.0,
    sybil_flagged: 0,
    message: message || undefined,
  });

  await ctx.reply(
    `💸 Tip initiated!\n\n` +
    `To: @${target}\n` +
    `Amount: ${baseUnitsToUsdt(amountBigInt)} USDT\n\n` +
    `📨 Send exactly **${baseUnitsToUsdt(amountBigInt)} USDT** to:\n\`${escrow.address}\`\n\n` +
    `⏳ Waiting for deposit (5 min timeout)...`,
    { parse_mode: 'Markdown' }
  );

  // Background deposit confirmation
  escrowManager.confirmDeposit(tip.id).then(async confirmed => {
    if (confirmed) {
      tipsRepo.update(tip.id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
      const analysis = await sybilDetector.analyzeTip(tipsRepo.findById(tip.id)!);
      await ctx.reply(
        `✅ Deposit confirmed!\n\nSybil weight: ${analysis.weight}\n` +
        (analysis.flagged ? `⚠️ Flagged: ${analysis.reasons.join(', ')}` : '✅ Clean')
      );
    } else {
      tipsRepo.update(tip.id, { status: 'expired' });
      await ctx.reply('❌ Deposit not received within 5 minutes. Tip expired.');
    }
  }).catch(err => logger.error({ err }, 'Tip confirmation error'));
}
