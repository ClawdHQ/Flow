import { Context } from 'grammy';
import { getChainDisplayName } from '../../config/chains.js';
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
    await ctx.reply(`💰 Your ${getChainDisplayName(creator.preferred_chain)} balance is 0 USD₮.`);
    return;
  }

  try {
    const txHash = await creatorWallet.withdraw(creator.id, creator.payout_address, balance);
    const isDemoHash = txHash.startsWith('0xMOCK');
    const txNote = isDemoHash
      ? '\n\n⚠️ _Demo mode: tx hash is simulated. Fund the pool wallet and configure RPC for live transfers._'
      : `\n\n🔗 TX: \`${txHash}\``;
    await ctx.reply(
      `✅ Withdrawal successful!\n\n` +
      `Chain: ${getChainDisplayName(creator.preferred_chain)}\n` +
      `Amount: ${baseUnitsToUsdt(balance)} USD₮\n` +
      `To: \`${creator.payout_address}\`` +
      txNote,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error({ err }, 'Withdrawal failed');
    await ctx.reply('❌ Withdrawal failed. Please try again later.');
  }
}
