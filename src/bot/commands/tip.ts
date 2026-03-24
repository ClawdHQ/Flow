import { Context } from 'grammy';
import { getChainDisplayName } from '../../config/chains.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { TipsRepository } from '../../storage/repositories/tips.js';
import { RoundsRepository } from '../../storage/repositories/rounds.js';
import { EscrowWalletManager } from '../../wallet/escrow.js';
import { watchTipDeposit } from '../tip-monitor.js';
import { usdtToBaseUnits, baseUnitsToUsdt } from '../../utils/math.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { computeSplitBreakdown, getDefaultSplitConfig } from '../../agent/splits.js';
import { SplitsRepository } from '../../storage/repositories/splits.js';

const creatorsRepo = new CreatorsRepository();
const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const escrowManager = new EscrowWalletManager();
const splitsRepo = new SplitsRepository();

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
    await ctx.reply('❌ Minimum tip amount is 1 USD₮.');
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
  const splitRecord = splitsRepo.findByCreatorId(creator.id);
  const split = splitRecord ? {
    creatorId: creator.id,
    creatorBps: splitRecord.creator_bps,
    poolBps: splitRecord.pool_bps,
    protocolBps: splitRecord.protocol_bps,
    collaborators: splitRecord.collaborators ? JSON.parse(splitRecord.collaborators) : []
  } : getDefaultSplitConfig(creator.id);

  const breakdown = computeSplitBreakdown(amountBigInt, split);

  const tip = tipsRepo.create({
    tip_uuid: uuidv4(),
    round_id: round.id,
    tipper_telegram_id: String(ctx.from?.id ?? ''),
    creator_id: creator.id,
    amount_usdt: amountBigInt.toString(),
    effective_amount: amountBigInt.toString(),
    chain: creator.preferred_chain,
    status: 'pending',
    sybil_weight: 1.0,
    sybil_flagged: 0,
    message: message || undefined,
    protocol_fee: breakdown.protocolAmount.toString(),
    pool_fee: breakdown.poolAmount.toString(),
    creator_share: breakdown.creatorAmount.toString(),
  });

  let escrow;
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  try {
    escrow = await escrowManager.createForTip(tip.id, amountBigInt, creator.preferred_chain, {
      chatId: chatId !== undefined ? String(chatId) : undefined,
    });
    tipsRepo.update(tip.id, {
      escrow_address: escrow.address,
      chain: escrow.chain,
    });
  } catch (err) {
    tipsRepo.update(tip.id, { status: 'failed' });
    logger.error({ err, tipId: tip.id, creatorId: creator.id }, 'Escrow wallet creation failed');
    await ctx.reply('❌ Failed to create a deposit address. Please try again later.');
    return;
  }

  await ctx.reply(
    `💸 Tip initiated!\n\n` +
    `To: @${target}\n` +
    `Amount: ${baseUnitsToUsdt(amountBigInt)} USD₮\n\n` +
    `Network: ${getChainDisplayName(escrow.chain)}\n` +
    `📨 Send exactly **${baseUnitsToUsdt(amountBigInt)} USD₮** to:\n\`${escrow.address}\`\n\n` +
    `⏳ Waiting for deposit (5 min timeout)...`,
    { parse_mode: 'Markdown' }
  );

  void watchTipDeposit(tip.id, async messageText => {
    await ctx.reply(messageText);
  });
}
