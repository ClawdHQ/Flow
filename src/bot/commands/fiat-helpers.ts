import {
  type MoonPayAmountInput,
  type MoonPayBuyLinkResult,
  type MoonPayConfigStatus,
  type MoonPaySellLinkResult,
  baseUnitsToDecimalString,
} from '../../fiat/moonpay.js';

export const MOONPAY_BUY_USAGE =
  'Usage: /buy <crypto_asset> <fiat_currency> <fiat:100|crypto:0.1> <recipient_wallet>';
export const MOONPAY_SELL_USAGE =
  'Usage: /sell <crypto_asset> <fiat_currency> <crypto:0.5|fiat:100> [refund_wallet]';
export const MOONPAY_FIAT_USAGE = [
  'Usage:',
  '/fiat',
  '/fiat crypto [filter]',
  '/fiat fiat [filter]',
  '/fiat countries [filter]',
  '/fiat tx <transaction_id> [buy|sell]',
  MOONPAY_BUY_USAGE,
  MOONPAY_SELL_USAGE,
].join('\n');

export function parseMoonPayAmountSpec(spec?: string): MoonPayAmountInput {
  if (!spec) {
    throw new Error('Amount is required. Use fiat:<amount> or crypto:<amount>.');
  }

  const separatorIndex = spec.indexOf(':');
  if (separatorIndex === -1) {
    throw new Error('Amount must use fiat:<amount> or crypto:<amount>.');
  }

  const kind = spec.slice(0, separatorIndex).trim().toLowerCase();
  const value = spec.slice(separatorIndex + 1).trim();

  if ((kind !== 'fiat' && kind !== 'crypto') || value === '') {
    throw new Error('Amount must use fiat:<amount> or crypto:<amount>.');
  }

  return {
    kind,
    value,
  } as MoonPayAmountInput;
}

export function formatMoonPayConfigStatus(status: MoonPayConfigStatus): string {
  if (status.configured) {
    return 'MoonPay fiat is configured.';
  }

  return `MoonPay fiat is not configured. Missing: ${status.missing.join(', ')}`;
}

export function formatMoonPayBuySummary(result: MoonPayBuyLinkResult, recipient: string): string {
  const cryptoAmount = baseUnitsToDecimalString(result.quote.cryptoAmount, result.cryptoAsset.decimals);
  const fiatAmount = baseUnitsToDecimalString(result.quote.fiatAmount, result.fiatCurrency.decimals);
  const feeAmount = baseUnitsToDecimalString(result.quote.fee, result.fiatCurrency.decimals);

  return [
    `MoonPay buy link ready.`,
    `Asset: ${result.cryptoAsset.code} (${result.cryptoAsset.name}) on ${result.cryptoAsset.networkCode}`,
    `Quote: ${fiatAmount} ${result.fiatCurrency.code.toUpperCase()} -> ${cryptoAmount} ${result.cryptoAsset.code.toUpperCase()}`,
    `Fee estimate: ${feeAmount} ${result.fiatCurrency.code.toUpperCase()}`,
    `Recipient: ${recipient}`,
    `Rate: ${result.quote.rate}`,
    '',
    result.url,
  ].join('\n');
}

export function formatMoonPaySellSummary(result: MoonPaySellLinkResult, refundAddress?: string): string {
  const lines = [
    'MoonPay sell link ready.',
    `Asset: ${result.cryptoAsset.code} (${result.cryptoAsset.name}) on ${result.cryptoAsset.networkCode}`,
  ];

  if (result.quote) {
    const cryptoAmount = baseUnitsToDecimalString(result.quote.cryptoAmount, result.cryptoAsset.decimals);
    const fiatAmount = baseUnitsToDecimalString(result.quote.fiatAmount, result.fiatCurrency.decimals);
    const feeAmount = baseUnitsToDecimalString(result.quote.fee, result.fiatCurrency.decimals);
    lines.push(`Quote: ${cryptoAmount} ${result.cryptoAsset.code.toUpperCase()} -> ${fiatAmount} ${result.fiatCurrency.code.toUpperCase()}`);
    lines.push(`Fee estimate: ${feeAmount} ${result.fiatCurrency.code.toUpperCase()}`);
    lines.push(`Rate: ${result.quote.rate}`);
  } else {
    lines.push('Quote: MoonPay will finalize the crypto amount inside the widget for fiat-targeted sell requests.');
  }

  if (refundAddress) {
    lines.push(`Refund wallet: ${refundAddress}`);
  }

  lines.push('');
  lines.push(result.url);

  return lines.join('\n');
}

export function buildMoonPayExternalCustomerId(telegramId?: number): string | undefined {
  if (!telegramId) return undefined;
  return `telegram:${telegramId}`;
}

export function buildMoonPayExternalTransactionId(direction: 'buy' | 'sell', telegramId?: number): string | undefined {
  if (!telegramId) return undefined;
  return `flow-${direction}-${telegramId}-${Date.now()}`;
}
