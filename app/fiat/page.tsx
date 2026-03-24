'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Globe,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
} from 'lucide-react';

const SUPPORTED_FIAT = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'KRW'] as const;
const SUPPORTED_CRYPTO = [
  { symbol: 'USDT', name: 'Tether USD', chains: ['Ethereum', 'Polygon', 'Arbitrum', 'TRON', 'TON'] },
  { symbol: 'BTC', name: 'Bitcoin', chains: ['Bitcoin'] },
  { symbol: 'ETH', name: 'Ethereum', chains: ['Ethereum', 'Arbitrum'] },
  { symbol: 'TRX', name: 'TRON', chains: ['TRON'] },
  { symbol: 'TON', name: 'Toncoin', chains: ['TON'] },
] as const;

type Mode = 'buy' | 'sell';

export default function FiatPage() {
  const [mode, setMode] = useState<Mode>('buy');
  const [fiatCurrency, setFiatCurrency] = useState('USD');
  const [cryptoAsset, setCryptoAsset] = useState('USDT');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);

  function handleMoonPayRedirect() {
    setLoading(true);
    // In production, this would call the MoonPay SDK or redirect URL
    // For now, show the integration pattern
    const moonpayUrl = `https://buy.moonpay.com/?apiKey=${process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? 'DEMO'}&currencyCode=${cryptoAsset.toLowerCase()}&baseCurrencyCode=${fiatCurrency.toLowerCase()}&baseCurrencyAmount=${amount}`;
    
    setTimeout(() => {
      setLoading(false);
      window.open(moonpayUrl, '_blank', 'noopener,noreferrer');
    }, 1000);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12 max-w-4xl mx-auto">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[450px] h-[450px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] rounded-full bg-yellow-500/6 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-4">
          <Banknote className="h-4 w-4" />
          Powered by MoonPay × WDK
        </div>
        <h1 className="text-4xl font-bold mb-2">Fiat On/Off Ramp</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Buy and sell crypto with your credit card, bank transfer, or Apple Pay.
          Integrated via <code className="text-primary bg-primary/10 px-1 rounded text-xs">@tetherto/wdk-protocol-fiat-moonpay</code>.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Fiat Form */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              {mode === 'buy' ? 'Buy Crypto' : 'Sell Crypto'}
            </CardTitle>
            <CardDescription>
              {mode === 'buy'
                ? 'Purchase crypto with fiat currency'
                : 'Convert your crypto back to fiat'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex rounded-xl bg-muted/30 p-1">
              <button
                onClick={() => setMode('buy')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  mode === 'buy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Buy
              </button>
              <button
                onClick={() => setMode('sell')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  mode === 'sell'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Sell
              </button>
            </div>

            {/* Fiat Currency */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {mode === 'buy' ? 'You Pay' : 'You Receive'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/50 focus:outline-none text-lg font-mono"
                  placeholder="0.00"
                  min="10"
                />
                <select
                  value={fiatCurrency}
                  onChange={e => setFiatCurrency(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/50 focus:outline-none text-sm font-medium appearance-none cursor-pointer min-w-[80px]"
                >
                  {SUPPORTED_FIAT.map(cur => (
                    <option key={cur} value={cur}>{cur}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Crypto Asset */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {mode === 'buy' ? 'You Receive' : 'You Pay'}
              </label>
              <div className="space-y-2">
                {SUPPORTED_CRYPTO.map(crypto => (
                  <button
                    key={crypto.symbol}
                    onClick={() => setCryptoAsset(crypto.symbol)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      cryptoAsset === crypto.symbol
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{crypto.symbol}</div>
                      <div className="text-xs text-muted-foreground">{crypto.name}</div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {crypto.chains.map(c => (
                        <Badge key={c} variant="outline" className="text-[9px] px-1">{c}</Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Action */}
            <Button
              onClick={handleMoonPayRedirect}
              className={`w-full ${mode === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              size="lg"
              disabled={loading || !amount}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting to MoonPay...</>
              ) : (
                <><ExternalLink className="h-4 w-4 mr-2" /> {mode === 'buy' ? 'Buy' : 'Sell'} with MoonPay</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Panel */}
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Credit / Debit Card</div>
                  <div className="text-xs text-muted-foreground">Visa, Mastercard, Apple Pay, Google Pay</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Bank Transfer</div>
                  <div className="text-xs text-muted-foreground">SEPA, ACH, Faster Payments, Wire</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Regional Options</div>
                  <div className="text-xs text-muted-foreground">PIX, Open Banking, iDEAL</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Supported Chains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['Ethereum', 'Polygon', 'Arbitrum', 'Avalanche', 'TRON', 'TON', 'Bitcoin'].map(chain => (
                  <Badge key={chain} variant="outline" className="text-xs">{chain}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Fiat onramp deposits directly to your WDK-managed wallet address.
                Offramp withdraws from your connected wallet.
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1">KYC Handled by MoonPay</h4>
                  <p className="text-xs text-muted-foreground">
                    Flow never sees your identity documents. All KYC/AML compliance is handled
                    securely by MoonPay's regulated infrastructure.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
