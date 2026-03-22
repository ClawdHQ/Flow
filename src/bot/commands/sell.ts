import { Context } from 'grammy';
import { moonPayService } from '../../fiat/moonpay.js';
import { logger } from '../../utils/logger.js';
import {
  MOONPAY_SELL_USAGE,
  buildMoonPayExternalCustomerId,
  buildMoonPayExternalTransactionId,
  formatMoonPayConfigStatus,
  formatMoonPaySellSummary,
  parseMoonPayAmountSpec,
} from './fiat-helpers.js';

export async function handleSell(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const cryptoAsset = parts[1];
  const fiatCurrency = parts[2];
  const amountSpec = parts[3];
  const refundAddress = parts[4];
  const configStatus = moonPayService.getConfigurationStatus();

  if (!configStatus.configured) {
    await ctx.reply(`${formatMoonPayConfigStatus(configStatus)}\n\n${MOONPAY_SELL_USAGE}`);
    return;
  }

  if (!cryptoAsset || !fiatCurrency || !amountSpec) {
    await ctx.reply(MOONPAY_SELL_USAGE);
    return;
  }

  try {
    const amount = parseMoonPayAmountSpec(amountSpec);
    const result = await moonPayService.createSellLink({
      cryptoAsset,
      fiatCurrency,
      amount,
      refundAddress,
      externalCustomerId: buildMoonPayExternalCustomerId(ctx.from?.id),
      externalTransactionId: buildMoonPayExternalTransactionId('sell', ctx.from?.id),
    });

    await ctx.reply(formatMoonPaySellSummary(result, refundAddress));
  } catch (err) {
    logger.error({ err }, 'MoonPay sell command failed');
    const message = err instanceof Error ? err.message : 'Unable to create MoonPay sell link.';
    await ctx.reply(`${message}\n\n${MOONPAY_SELL_USAGE}`);
  }
}
