import { Context } from 'grammy';
import { moonPayService } from '../../fiat/moonpay.js';
import { logger } from '../../utils/logger.js';
import {
  MOONPAY_BUY_USAGE,
  buildMoonPayExternalCustomerId,
  buildMoonPayExternalTransactionId,
  formatMoonPayBuySummary,
  formatMoonPayConfigStatus,
  parseMoonPayAmountSpec,
} from './fiat-helpers.js';

export async function handleBuy(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const cryptoAsset = parts[1];
  const fiatCurrency = parts[2];
  const amountSpec = parts[3];
  const recipient = parts[4];
  const configStatus = moonPayService.getConfigurationStatus();

  if (!configStatus.configured) {
    await ctx.reply(`${formatMoonPayConfigStatus(configStatus)}\n\n${MOONPAY_BUY_USAGE}`);
    return;
  }

  if (!cryptoAsset || !fiatCurrency || !amountSpec || !recipient) {
    await ctx.reply(MOONPAY_BUY_USAGE);
    return;
  }

  try {
    const amount = parseMoonPayAmountSpec(amountSpec);
    const result = await moonPayService.createBuyLink({
      cryptoAsset,
      fiatCurrency,
      amount,
      recipient,
      externalCustomerId: buildMoonPayExternalCustomerId(ctx.from?.id),
      externalTransactionId: buildMoonPayExternalTransactionId('buy', ctx.from?.id),
    });

    await ctx.reply(formatMoonPayBuySummary(result, recipient));
  } catch (err) {
    logger.error({ err }, 'MoonPay buy command failed');
    const message = err instanceof Error ? err.message : 'Unable to create MoonPay buy link.';
    await ctx.reply(`${message}\n\n${MOONPAY_BUY_USAGE}`);
  }
}
