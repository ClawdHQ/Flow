import { Context } from 'grammy';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { CreatorWalletManager } from '../../wallet/creator.js';
import { baseUnitsToUsdt } from '../../utils/math.js';
import { logger } from '../../utils/logger.js';

const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

export async function handleWithdraw(ctx: Context): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  const creator = creatorsRepo.findByTelegramId(telegramId);

  if (!creator) {
    await ctx.reply('❌ You are not registered. Use /register first.');
    return;
  }

  const balance = await creatorWallet.getBalance(creator.id);
  if (balance === 0n) {
    await ctx.reply('💰 Your balance is 0 USDT.');
    return;
  }

  try {
    const txHash = await creatorWallet.withdraw(creator.id, creator.payout_address, balance);
    await ctx.reply(
      `✅ Withdrawal successful!\n\n` +
      `Amount: ${baseUnitsToUsdt(balance)} USDT\n` +
      `To: \`${creator.payout_address}\`\n` +
      `TX: \`${txHash}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error({ err }, 'Withdrawal failed');
    await ctx.reply('❌ Withdrawal failed. Please try again later.');
  }
}
