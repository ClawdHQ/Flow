import { Context } from 'grammy';
import { getChainDisplayName } from '../../config/chains.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { CreatorWalletManager } from '../../wallet/creator.js';
import { baseUnitsToUsdt } from '../../utils/math.js';

const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

export async function handleBalance(ctx: Context): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  const creator = creatorsRepo.findByTelegramId(telegramId);

  if (!creator) {
    await ctx.reply('❌ You are not registered. Use /register first.');
    return;
  }

  const wallet = await creatorWallet.getOrCreateWallet(creator.id);
  const balance = await creatorWallet.getBalance(creator.id);

  await ctx.reply(
    `💰 **Your Balance**\n\n` +
      `Available: ${baseUnitsToUsdt(balance)} USD₮\n` +
      `Accumulation wallet: \`${wallet.address}\`\n` +
      `Chain: ${getChainDisplayName(wallet.chain)}\n` +
      `Payout wallet: \`${creator.payout_address}\`\n\n` +
      `Use /deposit to add funds or /withdraw to send everything to your payout wallet.`,
    { parse_mode: 'Markdown' }
  );
}
