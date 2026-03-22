import MoonPayProtocol, {
  type MoonPayBuyParams,
  type MoonPaySellParams,
} from '@tetherto/wdk-protocol-fiat-moonpay';
import { config } from '../config/index.js';

export type MoonPayAmountKind = 'crypto' | 'fiat';
export type MoonPayDirection = 'buy' | 'sell';

export interface MoonPayAmountInput {
  kind: MoonPayAmountKind;
  value: string;
}

export interface MoonPaySupportedCryptoAsset {
  code: string;
  decimals: number;
  networkCode: string;
  name: string;
  metadata: {
    isSellSupported?: boolean;
    isSupportedInUs?: boolean;
    isSuspended?: boolean;
    supportsTestMode?: boolean;
    chainId?: string | null;
    contractAddress?: string | null;
    networkCode: string;
  };
}

export interface MoonPaySupportedFiatCurrency {
  code: string;
  decimals: number;
  name: string;
  metadata: {
    isSellSupported?: boolean;
  };
}

export interface MoonPaySupportedCountry {
  code: string;
  name: string;
  isBuyAllowed: boolean;
  isSellAllowed: boolean;
  metadata: Record<string, unknown>;
}

export interface MoonPayQuoteResult {
  cryptoAmount: bigint;
  fiatAmount: bigint;
  fee: bigint;
  rate: string;
  metadata: Record<string, unknown>;
}

export interface MoonPayBuyLinkResult {
  url: string;
  quote: MoonPayQuoteResult;
  cryptoAsset: MoonPaySupportedCryptoAsset;
  fiatCurrency: MoonPaySupportedFiatCurrency;
}

export interface MoonPaySellLinkResult {
  url: string;
  quote: MoonPayQuoteResult | null;
  cryptoAsset: MoonPaySupportedCryptoAsset;
  fiatCurrency: MoonPaySupportedFiatCurrency;
}

export interface MoonPayTransactionStatusResult {
  id: string;
  status: string;
  direction: MoonPayDirection;
  cryptoAsset: string;
  fiatCurrency: string;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string | null;
  metadata: Record<string, unknown>;
}

interface MoonPayClientConfig {
  apiKey: string;
  secretKey: string;
  cacheTime?: number;
}

interface MoonPayTransactionDetail {
  status: string;
  cryptoAsset: string;
  fiatCurrency: string;
  metadata: Record<string, unknown>;
}

interface MoonPayClient {
  buy(options: {
    cryptoAsset: string;
    fiatCurrency: string;
    cryptoAmount?: bigint;
    fiatAmount?: bigint;
    recipient?: string;
    config?: MoonPayBuyParams;
  }): Promise<{ buyUrl: string }>;
  sell(options: {
    cryptoAsset: string;
    fiatCurrency: string;
    cryptoAmount?: bigint;
    fiatAmount?: bigint;
    refundAddress?: string;
    config?: MoonPaySellParams;
  }): Promise<{ sellUrl: string }>;
  quoteBuy(options: {
    cryptoAsset: string;
    fiatCurrency: string;
    cryptoAmount?: bigint;
    fiatAmount?: bigint;
    config?: {
      walletAddress?: string;
    };
  }): Promise<MoonPayQuoteResult>;
  quoteSell(options: {
    cryptoAsset: string;
    fiatCurrency: string;
    cryptoAmount: bigint;
  }): Promise<MoonPayQuoteResult>;
  getSupportedCryptoAssets(): Promise<MoonPaySupportedCryptoAsset[]>;
  getSupportedFiatCurrencies(): Promise<MoonPaySupportedFiatCurrency[]>;
  getSupportedCountries(): Promise<MoonPaySupportedCountry[]>;
  getTransactionDetail(txId: string, direction?: MoonPayDirection): Promise<MoonPayTransactionDetail>;
}

type MoonPayProtocolFactory = (config: MoonPayClientConfig) => MoonPayClient;

export interface MoonPayConfigStatus {
  configured: boolean;
  missing: string[];
}

function defaultMoonPayProtocolFactory(protocolConfig: MoonPayClientConfig): MoonPayClient {
  return new MoonPayProtocol(undefined, protocolConfig) as unknown as MoonPayClient;
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeWidgetColor(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('#') ? value : `#${value}`;
}

function buildScale(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }
  return 10n ** BigInt(decimals);
}

export function decimalAmountToBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Error('Amount must be a positive decimal number.');
  }

  const [whole = '0', fractional = ''] = trimmed.split('.');
  if (fractional.length > decimals) {
    throw new Error(`Amount has too many decimal places. Max supported is ${decimals}.`);
  }

  const scale = buildScale(decimals);
  const wholeUnits = BigInt(whole) * scale;
  const fractionalUnits = fractional === ''
    ? 0n
    : BigInt(fractional.padEnd(decimals, '0'));

  return wholeUnits + fractionalUnits;
}

export function baseUnitsToDecimalString(value: bigint, decimals: number): string {
  const scale = buildScale(decimals);
  const whole = value / scale;
  const fractional = (value % scale).toString().padStart(decimals, '0');
  const trimmedFractional = fractional.replace(/0+$/, '');
  return trimmedFractional ? `${whole}.${trimmedFractional}` : whole.toString();
}

function buildMoonPayConfigStatus(): MoonPayConfigStatus {
  const missing: string[] = [];
  if (!config.MOONPAY_API_KEY) missing.push('MOONPAY_API_KEY');
  if (!config.MOONPAY_SECRET_KEY) missing.push('MOONPAY_SECRET_KEY');

  return {
    configured: missing.length === 0,
    missing,
  };
}

function buildDefaultBuyConfig(): MoonPayBuyParams {
  const widgetConfig: MoonPayBuyParams = {};
  if (config.MOONPAY_WIDGET_THEME) widgetConfig.theme = config.MOONPAY_WIDGET_THEME;
  if (config.MOONPAY_WIDGET_COLOR) widgetConfig.colorCode = normalizeWidgetColor(config.MOONPAY_WIDGET_COLOR);
  if (config.MOONPAY_WIDGET_LANGUAGE) widgetConfig.language = config.MOONPAY_WIDGET_LANGUAGE;
  if (config.MOONPAY_REDIRECT_URL) widgetConfig.redirectURL = config.MOONPAY_REDIRECT_URL;
  return widgetConfig;
}

function buildDefaultSellConfig(): MoonPaySellParams {
  const widgetConfig: MoonPaySellParams = {};
  if (config.MOONPAY_WIDGET_THEME) widgetConfig.theme = config.MOONPAY_WIDGET_THEME;
  if (config.MOONPAY_WIDGET_COLOR) widgetConfig.colorCode = normalizeWidgetColor(config.MOONPAY_WIDGET_COLOR);
  if (config.MOONPAY_WIDGET_LANGUAGE) widgetConfig.language = config.MOONPAY_WIDGET_LANGUAGE;
  if (config.MOONPAY_REDIRECT_URL) widgetConfig.redirectURL = config.MOONPAY_REDIRECT_URL;
  return widgetConfig;
}

export class MoonPayService {
  private client: MoonPayClient | null = null;

  constructor(private readonly protocolFactory: MoonPayProtocolFactory = defaultMoonPayProtocolFactory) {}

  getConfigurationStatus(): MoonPayConfigStatus {
    return buildMoonPayConfigStatus();
  }

  isConfigured(): boolean {
    return this.getConfigurationStatus().configured;
  }

  async getSupportedCryptoAssets(filter?: string): Promise<MoonPaySupportedCryptoAsset[]> {
    const client = this.getClient();
    const query = filter ? normalizeCode(filter) : null;
    const assets = await client.getSupportedCryptoAssets();

    return assets
      .filter(asset => {
        if (!query) return true;
        return [
          asset.code,
          asset.name,
          asset.networkCode,
          asset.metadata.contractAddress ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        const leftKey = `${left.code}:${left.networkCode}:${left.name}`;
        const rightKey = `${right.code}:${right.networkCode}:${right.name}`;
        return leftKey.localeCompare(rightKey);
      });
  }

  async getSupportedFiatCurrencies(filter?: string): Promise<MoonPaySupportedFiatCurrency[]> {
    const client = this.getClient();
    const query = filter ? normalizeCode(filter) : null;
    const currencies = await client.getSupportedFiatCurrencies();

    return currencies
      .filter(currency => {
        if (!query) return true;
        return `${currency.code} ${currency.name}`.toLowerCase().includes(query);
      })
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  async getSupportedCountries(filter?: string): Promise<MoonPaySupportedCountry[]> {
    const client = this.getClient();
    const query = filter ? normalizeCode(filter) : null;
    const countries = await client.getSupportedCountries();

    return countries
      .filter(country => {
        if (!query) return true;
        return `${country.code} ${country.name}`.toLowerCase().includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async createBuyLink(input: {
    cryptoAsset: string;
    fiatCurrency: string;
    amount: MoonPayAmountInput;
    recipient: string;
    externalCustomerId?: string;
    externalTransactionId?: string;
  }): Promise<MoonPayBuyLinkResult> {
    const client = this.getClient();
    const cryptoAsset = await this.getCryptoAsset(input.cryptoAsset);
    const fiatCurrency = await this.getFiatCurrency(input.fiatCurrency);
    const amountOptions = this.buildAmountOptions(input.amount, cryptoAsset.decimals, fiatCurrency.decimals);

    const quote = await client.quoteBuy({
      cryptoAsset: cryptoAsset.code,
      fiatCurrency: fiatCurrency.code,
      ...amountOptions,
      config: {
        walletAddress: input.recipient,
      },
    });

    const buyResult = await client.buy({
      cryptoAsset: cryptoAsset.code,
      fiatCurrency: fiatCurrency.code,
      ...amountOptions,
      recipient: input.recipient,
      config: {
        ...buildDefaultBuyConfig(),
        defaultCurrencyCode: cryptoAsset.code,
        walletAddress: input.recipient,
        lockAmount: true,
        externalCustomerId: input.externalCustomerId,
        externalTransactionId: input.externalTransactionId,
      },
    });

    return {
      url: buyResult.buyUrl,
      quote,
      cryptoAsset,
      fiatCurrency,
    };
  }

  async createSellLink(input: {
    cryptoAsset: string;
    fiatCurrency: string;
    amount: MoonPayAmountInput;
    refundAddress?: string;
    externalCustomerId?: string;
    externalTransactionId?: string;
  }): Promise<MoonPaySellLinkResult> {
    const client = this.getClient();
    const cryptoAsset = await this.getCryptoAsset(input.cryptoAsset);
    const fiatCurrency = await this.getFiatCurrency(input.fiatCurrency);
    const amountOptions = this.buildAmountOptions(input.amount, cryptoAsset.decimals, fiatCurrency.decimals);

    const quote = input.amount.kind === 'crypto'
      ? await client.quoteSell({
          cryptoAsset: cryptoAsset.code,
          fiatCurrency: fiatCurrency.code,
          cryptoAmount: amountOptions.cryptoAmount!,
        })
      : null;

    const sellResult = await client.sell({
      cryptoAsset: cryptoAsset.code,
      fiatCurrency: fiatCurrency.code,
      ...amountOptions,
      refundAddress: input.refundAddress,
      config: {
        ...buildDefaultSellConfig(),
        defaultBaseCurrencyCode: cryptoAsset.code,
        lockAmount: true,
        externalCustomerId: input.externalCustomerId,
        externalTransactionId: input.externalTransactionId,
      },
    });

    return {
      url: sellResult.sellUrl,
      quote,
      cryptoAsset,
      fiatCurrency,
    };
  }

  async getTransactionStatus(txId: string, direction: MoonPayDirection = 'buy'): Promise<MoonPayTransactionStatusResult> {
    const client = this.getClient();
    const detail = await client.getTransactionDetail(txId, direction);
    const metadata = detail.metadata ?? {};

    const cryptoAsset = direction === 'buy'
      ? this.readNestedString(metadata, ['currency', 'code']) ?? detail.cryptoAsset
      : this.readNestedString(metadata, ['baseCurrency', 'code']) ?? detail.cryptoAsset;
    const fiatCurrency = direction === 'buy'
      ? this.readNestedString(metadata, ['baseCurrency', 'code']) ?? detail.fiatCurrency
      : this.readNestedString(metadata, ['quoteCurrency', 'code']) ?? detail.fiatCurrency;

    return {
      id: this.readString(metadata, 'id') ?? txId,
      status: detail.status,
      direction,
      cryptoAsset,
      fiatCurrency,
      createdAt: this.readString(metadata, 'createdAt'),
      updatedAt: this.readString(metadata, 'updatedAt'),
      failureReason: this.readNullableString(metadata, 'failureReason'),
      metadata,
    };
  }

  private getClient(): MoonPayClient {
    const status = this.getConfigurationStatus();
    if (!status.configured) {
      throw new Error(`MoonPay is not configured. Missing: ${status.missing.join(', ')}`);
    }

    if (!this.client) {
      this.client = this.protocolFactory({
        apiKey: config.MOONPAY_API_KEY!,
        secretKey: config.MOONPAY_SECRET_KEY!,
        cacheTime: config.MOONPAY_CACHE_TIME_MS,
      });
    }

    return this.client;
  }

  private async getCryptoAsset(code: string): Promise<MoonPaySupportedCryptoAsset> {
    const normalized = normalizeCode(code);
    const assets = await this.getSupportedCryptoAssets(normalized);
    const match = assets.find(asset => asset.code === normalized);

    if (!match) {
      throw new Error(`Unsupported MoonPay crypto asset: ${normalized}`);
    }

    return match;
  }

  private async getFiatCurrency(code: string): Promise<MoonPaySupportedFiatCurrency> {
    const normalized = normalizeCode(code);
    const currencies = await this.getSupportedFiatCurrencies(normalized);
    const match = currencies.find(currency => currency.code === normalized);

    if (!match) {
      throw new Error(`Unsupported MoonPay fiat currency: ${normalized}`);
    }

    return match;
  }

  private buildAmountOptions(
    amount: MoonPayAmountInput,
    cryptoDecimals: number,
    fiatDecimals: number,
  ): { cryptoAmount?: bigint; fiatAmount?: bigint } {
    if (amount.kind === 'crypto') {
      return {
        cryptoAmount: decimalAmountToBaseUnits(amount.value, cryptoDecimals),
      };
    }

    return {
      fiatAmount: decimalAmountToBaseUnits(amount.value, fiatDecimals),
    };
  }

  private readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' ? value : undefined;
  }

  private readNullableString(source: Record<string, unknown>, key: string): string | null | undefined {
    const value = source[key];
    if (value === null) return null;
    return typeof value === 'string' ? value : undefined;
  }

  private readNestedString(source: Record<string, unknown>, path: string[]): string | undefined {
    let current: unknown = source;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'string' ? current : undefined;
  }
}

export const moonPayService = new MoonPayService();
