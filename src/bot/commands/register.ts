import { Context } from 'grammy';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { walletManager } from '../../wallet/index.js';
import { logger } from '../../utils/logger.js';
import { ethers } from 'ethers';

const creatorsRepo = new CreatorsRepository();

export async function handleRegister(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const walletAddress = parts[1];
  const chain = parts[2] ?? 'polygon';

  if (!walletAddress) {
    await ctx.reply('Usage: /register <wallet_address> [chain]\nExample: /register 0x1234... polygon');
    return;
  }

  try {
    ethers.getAddress(walletAddress);
  } catch {
    await ctx.reply('❌ Invalid wallet address format.');
    return;
  }

  const telegramId = String(ctx.from?.id ?? '');
  const username = ctx.from?.username ?? `user_${telegramId}`;

  const existing = creatorsRepo.findByTelegramId(telegramId);
  if (existing) {
    await ctx.reply(`✅ Already registered!\n\nYour accumulation wallet: \`${existing.accumulation_wallet_address}\``, { parse_mode: 'Markdown' });
    return;
  }

  const creatorIndex = creatorsRepo.count();
  const accWallet = await walletManager.getCreatorWallet(creatorIndex);

  const creator = creatorsRepo.create({
    telegram_id: telegramId,
    username,
    payout_address: walletAddress,
    preferred_chain: chain,
    accumulation_wallet_address: accWallet.address,
    accumulation_wallet_path: accWallet.hdPath,
  });

  logger.info({ creatorId: creator.id, username }, 'Creator registered');
  await ctx.reply(
    `✅ Registered as @${username}!\n\n` +
    `💰 Your accumulation wallet: \`${accWallet.address}\`\n` +
    `🔗 Chain: ${chain}\n` +
    `📤 Payouts to: \`${walletAddress}\``,
    { parse_mode: 'Markdown' }
  );
}
