import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MoonPayService', () => {
  async function loadMoonPayModule() {
    vi.resetModules();
    return import('../src/fiat/moonpay.js');
  }

  beforeEach(() => {
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';

    delete process.env['MOONPAY_API_KEY'];
    delete process.env['MOONPAY_SECRET_KEY'];
    delete process.env['MOONPAY_CACHE_TIME_MS'];
    delete process.env['MOONPAY_WIDGET_THEME'];
    delete process.env['MOONPAY_WIDGET_COLOR'];
    delete process.env['MOONPAY_WIDGET_LANGUAGE'];
    delete process.env['MOONPAY_REDIRECT_URL'];
  });

  it('converts decimal strings to base units and back', async () => {
    const moonPayModule = await loadMoonPayModule();

    expect(moonPayModule.decimalAmountToBaseUnits('100', 2)).toBe(10000n);
    expect(moonPayModule.decimalAmountToBaseUnits('0.123456', 6)).toBe(123456n);
    expect(moonPayModule.baseUnitsToDecimalString(123456n, 6)).toBe('0.123456');
    expect(moonPayModule.baseUnitsToDecimalString(1500000000000000000n, 18)).toBe('1.5');
  });

  it('reports missing MoonPay credentials when fiat is not configured', async () => {
    const { MoonPayService } = await loadMoonPayModule();
    const service = new MoonPayService(() => {
      throw new Error('MoonPay client should not be created when config is missing');
    });

    expect(service.getConfigurationStatus()).toEqual({
      configured: false,
      missing: ['MOONPAY_API_KEY', 'MOONPAY_SECRET_KEY'],
    });
    expect(service.isConfigured()).toBe(false);
  });

  it('creates buy links with widget defaults and a fiat-denominated quote', async () => {
    process.env['MOONPAY_API_KEY'] = 'pk_test_123';
    process.env['MOONPAY_SECRET_KEY'] = 'sk_test_456';
    process.env['MOONPAY_WIDGET_THEME'] = 'light';
    process.env['MOONPAY_WIDGET_COLOR'] = '112233';
    process.env['MOONPAY_WIDGET_LANGUAGE'] = 'en';
    process.env['MOONPAY_REDIRECT_URL'] = 'https://flow.test/complete';

    const { MoonPayService } = await loadMoonPayModule();
    const client = {
      getSupportedCryptoAssets: vi.fn().mockResolvedValue([
        {
          code: 'eth',
          decimals: 18,
          networkCode: 'ethereum',
          name: 'Ethereum',
          metadata: {
            networkCode: 'ethereum',
            isSellSupported: true,
            isSupportedInUs: true,
            isSuspended: false,
            supportsTestMode: true,
          },
        },
      ]),
      getSupportedFiatCurrencies: vi.fn().mockResolvedValue([
        {
          code: 'usd',
          decimals: 2,
          name: 'US Dollar',
          metadata: {
            isSellSupported: true,
          },
        },
      ]),
      getSupportedCountries: vi.fn().mockResolvedValue([]),
      getTransactionDetail: vi.fn(),
      quoteBuy: vi.fn().mockResolvedValue({
        cryptoAmount: 50000000000000000n,
        fiatAmount: 10000n,
        fee: 350n,
        rate: '0.0005',
        metadata: {},
      }),
      quoteSell: vi.fn(),
      buy: vi.fn().mockResolvedValue({
        buyUrl: 'https://buy.moonpay.test/session',
      }),
      sell: vi.fn(),
    };

    const service = new MoonPayService(() => client);
    const result = await service.createBuyLink({
      cryptoAsset: 'ETH',
      fiatCurrency: 'USD',
      amount: {
        kind: 'fiat',
        value: '100',
      },
      recipient: '0x1234567890123456789012345678901234567890',
      externalCustomerId: 'telegram:7',
      externalTransactionId: 'flow-buy-7-1',
    });

    expect(client.quoteBuy).toHaveBeenCalledWith({
      cryptoAsset: 'eth',
      fiatCurrency: 'usd',
      fiatAmount: 10000n,
      config: {
        walletAddress: '0x1234567890123456789012345678901234567890',
      },
    });
    expect(client.buy).toHaveBeenCalledWith({
      cryptoAsset: 'eth',
      fiatCurrency: 'usd',
      fiatAmount: 10000n,
      recipient: '0x1234567890123456789012345678901234567890',
      config: {
        theme: 'light',
        colorCode: '#112233',
        language: 'en',
        redirectURL: 'https://flow.test/complete',
        defaultCurrencyCode: 'eth',
        walletAddress: '0x1234567890123456789012345678901234567890',
        lockAmount: true,
        externalCustomerId: 'telegram:7',
        externalTransactionId: 'flow-buy-7-1',
      },
    });
    expect(result.url).toBe('https://buy.moonpay.test/session');
    expect(result.quote.fiatAmount).toBe(10000n);
    expect(result.cryptoAsset.networkCode).toBe('ethereum');
  });

  it('creates sell links for fiat-targeted requests without forcing a quote', async () => {
    process.env['MOONPAY_API_KEY'] = 'pk_test_123';
    process.env['MOONPAY_SECRET_KEY'] = 'sk_test_456';
    process.env['MOONPAY_WIDGET_THEME'] = 'dark';

    const { MoonPayService } = await loadMoonPayModule();
    const client = {
      getSupportedCryptoAssets: vi.fn().mockResolvedValue([
        {
          code: 'eth',
          decimals: 18,
          networkCode: 'ethereum',
          name: 'Ethereum',
          metadata: {
            networkCode: 'ethereum',
            isSellSupported: true,
            isSupportedInUs: true,
            isSuspended: false,
            supportsTestMode: true,
          },
        },
      ]),
      getSupportedFiatCurrencies: vi.fn().mockResolvedValue([
        {
          code: 'usd',
          decimals: 2,
          name: 'US Dollar',
          metadata: {
            isSellSupported: true,
          },
        },
      ]),
      getSupportedCountries: vi.fn().mockResolvedValue([]),
      getTransactionDetail: vi.fn(),
      quoteBuy: vi.fn(),
      quoteSell: vi.fn(),
      buy: vi.fn(),
      sell: vi.fn().mockResolvedValue({
        sellUrl: 'https://sell.moonpay.test/session',
      }),
    };

    const service = new MoonPayService(() => client);
    const result = await service.createSellLink({
      cryptoAsset: 'eth',
      fiatCurrency: 'usd',
      amount: {
        kind: 'fiat',
        value: '125.50',
      },
      refundAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      externalCustomerId: 'telegram:9',
      externalTransactionId: 'flow-sell-9-1',
    });

    expect(client.quoteSell).not.toHaveBeenCalled();
    expect(client.sell).toHaveBeenCalledWith({
      cryptoAsset: 'eth',
      fiatCurrency: 'usd',
      fiatAmount: 12550n,
      refundAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      config: {
        theme: 'dark',
        defaultBaseCurrencyCode: 'eth',
        lockAmount: true,
        externalCustomerId: 'telegram:9',
        externalTransactionId: 'flow-sell-9-1',
      },
    });
    expect(result.url).toBe('https://sell.moonpay.test/session');
    expect(result.quote).toBeNull();
  });
});
