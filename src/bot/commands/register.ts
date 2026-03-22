import { Context } from 'grammy';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { getChainDisplayName, getDefaultChain, normalizeChain, SUPPORTED_CHAINS } from '../../config/chains.js';
import { CreatorWalletManager } from '../../wallet/creator.js';
import { normalizeWalletAddress } from '../../wallet/addresses.js';
import { logger } from '../../utils/logger.js';

const creatorsRepo = new CreatorsRepository();
const creatorWallet = new CreatorWalletManager();

export async function handleRegister(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const walletAddress = parts[1];
  const defaultChain = getDefaultChain();
  const chain = normalizeChain(parts[2] ?? defaultChain);

  if (!walletAddress) {
    await ctx.reply(
      `Usage: /register <wallet_address> [chain]\nExample: /register 0x1234... ${defaultChain}\nSupported: ${SUPPORTED_CHAINS.join(', ')}`
    );
    return;
  }

  if (!chain) {
    await ctx.reply(`❌ Unsupported chain. Choose one of: ${SUPPORTED_CHAINS.join(', ')}`);
    return;
  }

  let normalizedPayoutAddress: string;
  try {
    normalizedPayoutAddress = normalizeWalletAddress(walletAddress, chain);
  } catch {
    await ctx.reply('❌ Invalid wallet address format.');
    return;
  }

  const telegramId = String(ctx.from?.id ?? '');
  const username = ctx.from?.username ?? `user_${telegramId}`;

  const existing = creatorsRepo.findByTelegramId(telegramId);
  if (existing) {
    const registrationChanged =
      existing.payout_address !== normalizedPayoutAddress || existing.preferred_chain !== chain;

    if (registrationChanged) {
      creatorsRepo.update(existing.id, {
        payout_address: normalizedPayoutAddress,
        preferred_chain: chain,
      });
    }

    const wallet = await creatorWallet.getOrCreateWallet(existing.id);
    await ctx.reply(
      `${registrationChanged ? '✅ Registration updated!' : '✅ Already registered!'}\n\n` +
        `💰 Your accumulation wallet: \`${wallet.address}\`\n` +
        `🔗 Chain: ${getChainDisplayName(wallet.chain)}\n` +
        `📤 Payouts to: \`${normalizedPayoutAddress}\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const creator = creatorsRepo.create({
    telegram_id: telegramId,
    username,
    payout_address: normalizedPayoutAddress,
    preferred_chain: chain,
  });
  const accWallet = await creatorWallet.getOrCreateWallet(creator.id);

  logger.info({ creatorId: creator.id, username }, 'Creator registered');
  await ctx.reply(
    `✅ Registered as @${username}!\n\n` +
      `💰 Your accumulation wallet: \`${accWallet.address}\`\n` +
      `🔗 Chain: ${getChainDisplayName(chain)}\n` +
      `📤 Payouts to: \`${normalizedPayoutAddress}\``,
    { parse_mode: 'Markdown' }
  );
}
