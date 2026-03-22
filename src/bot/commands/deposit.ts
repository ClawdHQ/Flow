import { Context } from 'grammy';
import { getChainDisplayName } from '../../config/chains.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { CreatorWalletManager } from '../../wallet/creator.js';
import { baseUnitsToUsdt } from '../../utils/math.js';

const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

export async function handleDeposit(ctx: Context): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  const creator = creatorsRepo.findByTelegramId(telegramId);

  if (!creator) {
    await ctx.reply('❌ You are not registered. Use /register first.');
    return;
  }

  const wallet = await creatorWallet.getOrCreateWallet(creator.id);
  const balance = await creatorWallet.getBalance(creator.id);

  await ctx.reply(
    `📥 **Deposit Funds**\n\n` +
      `Send Tether USD (USD₮) on **${getChainDisplayName(wallet.chain)}** to your accumulation wallet:\n` +
      `\`${wallet.address}\`\n\n` +
      `Current balance: ${baseUnitsToUsdt(balance)} USD₮\n` +
      `Payout wallet: \`${creator.payout_address}\`\n\n` +
      `Use /balance to refresh this balance and /withdraw to cash out.`,
    { parse_mode: 'Markdown' }
  );
}
