import { Context } from 'grammy';
import { moonPayService } from '../../fiat/moonpay.js';
import { logger } from '../../utils/logger.js';
import {
  MOONPAY_FIAT_USAGE,
  formatMoonPayConfigStatus,
} from './fiat-helpers.js';

const MAX_LIST_RESULTS = 15;

function formatOverflow(total: number): string {
  if (total <= MAX_LIST_RESULTS) {
    return '';
  }

  return `\nShowing ${MAX_LIST_RESULTS} of ${total} results. Add a filter to narrow it down.`;
}

export async function handleFiat(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const subcommand = parts[1]?.toLowerCase();
  const configStatus = moonPayService.getConfigurationStatus();

  if (!subcommand) {
    await ctx.reply(`${formatMoonPayConfigStatus(configStatus)}\n\n${MOONPAY_FIAT_USAGE}`);
    return;
  }

  if (!configStatus.configured) {
    await ctx.reply(`${formatMoonPayConfigStatus(configStatus)}\n\n${MOONPAY_FIAT_USAGE}`);
    return;
  }

  try {
    if (subcommand === 'crypto') {
      const filter = parts.slice(2).join(' ');
      const assets = await moonPayService.getSupportedCryptoAssets(filter);

      if (assets.length === 0) {
        await ctx.reply('No MoonPay crypto assets matched that filter.');
        return;
      }

      const lines = assets
        .slice(0, MAX_LIST_RESULTS)
        .map(asset => {
          const tags = [
            asset.networkCode,
            asset.metadata.isSellSupported ? 'sell' : 'buy-only',
            asset.metadata.isSupportedInUs === false ? 'not-US' : 'US',
          ].join(', ');
          return `- ${asset.code} - ${asset.name} (${tags})`;
        });

      await ctx.reply(`MoonPay crypto assets:\n${lines.join('\n')}${formatOverflow(assets.length)}`);
      return;
    }

    if (subcommand === 'fiat') {
      const filter = parts.slice(2).join(' ');
      const currencies = await moonPayService.getSupportedFiatCurrencies(filter);

      if (currencies.length === 0) {
        await ctx.reply('No MoonPay fiat currencies matched that filter.');
        return;
      }

      const lines = currencies
        .slice(0, MAX_LIST_RESULTS)
        .map(currency => `- ${currency.code} - ${currency.name}${currency.metadata.isSellSupported ? ' (buy and sell)' : ' (buy only)'}`);

      await ctx.reply(`MoonPay fiat currencies:\n${lines.join('\n')}${formatOverflow(currencies.length)}`);
      return;
    }

    if (subcommand === 'countries') {
      const filter = parts.slice(2).join(' ');
      const countries = await moonPayService.getSupportedCountries(filter);

      if (countries.length === 0) {
        await ctx.reply('No MoonPay countries matched that filter.');
        return;
      }

      const lines = countries
        .slice(0, MAX_LIST_RESULTS)
        .map(country => {
          const buy = country.isBuyAllowed ? 'buy' : 'no-buy';
          const sell = country.isSellAllowed ? 'sell' : 'no-sell';
          return `- ${country.code} - ${country.name} (${buy}, ${sell})`;
        });

      await ctx.reply(`MoonPay supported countries:\n${lines.join('\n')}${formatOverflow(countries.length)}`);
      return;
    }

    if (subcommand === 'tx') {
      const txId = parts[2];
      const direction = parts[3]?.toLowerCase() === 'sell' ? 'sell' : 'buy';

      if (!txId) {
        await ctx.reply(MOONPAY_FIAT_USAGE);
        return;
      }

      const transaction = await moonPayService.getTransactionStatus(txId, direction);
      const lines = [
        `MoonPay transaction: ${transaction.id}`,
        `Direction: ${transaction.direction}`,
        `Status: ${transaction.status}`,
        `Pair: ${transaction.cryptoAsset.toUpperCase()} / ${transaction.fiatCurrency.toUpperCase()}`,
      ];

      if (transaction.createdAt) lines.push(`Created: ${transaction.createdAt}`);
      if (transaction.updatedAt) lines.push(`Updated: ${transaction.updatedAt}`);
      if (transaction.failureReason) lines.push(`Failure: ${transaction.failureReason}`);

      await ctx.reply(lines.join('\n'));
      return;
    }

    await ctx.reply(MOONPAY_FIAT_USAGE);
  } catch (err) {
    logger.error({ err }, 'MoonPay fiat command failed');
    await ctx.reply('MoonPay request failed. Double-check the asset code or try again later.');
  }
}
