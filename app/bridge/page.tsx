'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Fuel,
  Zap,
  Globe,
} from 'lucide-react';

const BRIDGE_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', icon: '⟠', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', icon: '⬡', color: '#8247E5' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔷', color: '#28A0F0' },
  { id: 'avalanche', name: 'Avalanche', icon: '🔺', color: '#E84142' },
  { id: 'celo', name: 'Celo', icon: '🟡', color: '#FCFF52' },
  { id: 'tron', name: 'TRON', icon: '⚡', color: '#FF0013' },
  { id: 'ton', name: 'TON', icon: '💎', color: '#0098EA' },
] as const;

type BridgeStatus = 'idle' | 'quoting' | 'confirming' | 'bridging' | 'done' | 'error';

export default function BridgePage() {
  const [sourceChain, setSourceChain] = useState('polygon');
  const [targetChain, setTargetChain] = useState('ethereum');
  const [amount, setAmount] = useState('1.00');
  const [recipient, setRecipient] = useState('');
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [quote, setQuote] = useState<{ fee: string; bridgeFee: string } | null>(null);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  async function fetchQuote() {
    if (!amount || !recipient) return;
    setStatus('quoting');
    setError('');
    try {
      const res = await fetch('/api/bridge/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain,
          targetChain,
          amount: Math.floor(parseFloat(amount) * 1e6).toString(),
          recipient,
        }),
      });
      if (!res.ok) throw new Error('Failed to get quote');
      const data = await res.json();
      setQuote(data);
      setStatus('confirming');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
      setStatus('error');
    }
  }

  async function executeBridge() {
    setStatus('bridging');
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('flow_session_token') : null;
      const res = await fetch('/api/bridge/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetChain,
          amount: Math.floor(parseFloat(amount) * 1e6).toString(),
          recipient,
        }),
      });
      if (!res.ok) throw new Error('Bridge execution failed');
      const data = await res.json();
      setTxHash(data.txHash ?? data.hash ?? '');
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bridge failed');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12 max-w-4xl mx-auto">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/8 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Globe className="h-4 w-4" />
          Powered by USDT0 × LayerZero
        </div>
        <h1 className="text-4xl font-bold mb-2">Cross-Chain Bridge</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Bridge USD₮ across 25+ networks instantly using the USDT0 protocol.
          Paymaster-sponsored for zero gas fees on supported chains.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bridge Form */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Bridge USD₮
            </CardTitle>
            <CardDescription>Select source and destination chains</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source Chain */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">From</label>
              <div className="grid grid-cols-4 gap-2">
                {BRIDGE_CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setSourceChain(chain.id)}
                    disabled={chain.id === targetChain}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs transition-all ${
                      sourceChain === chain.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : chain.id === targetChain
                        ? 'border-border/30 opacity-30 cursor-not-allowed'
                        : 'border-border hover:border-primary/30 hover:bg-muted/40 cursor-pointer'
                    }`}
                  >
                    <span className="text-lg">{chain.icon}</span>
                    <span>{chain.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <button
                onClick={() => { setSourceChain(targetChain); setTargetChain(sourceChain); }}
                className="p-2 rounded-full border border-border hover:border-primary/40 hover:bg-primary/10 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Target Chain */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">To</label>
              <div className="grid grid-cols-4 gap-2">
                {BRIDGE_CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setTargetChain(chain.id)}
                    disabled={chain.id === sourceChain}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs transition-all ${
                      targetChain === chain.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : chain.id === sourceChain
                        ? 'border-border/30 opacity-30 cursor-not-allowed'
                        : 'border-border hover:border-primary/30 hover:bg-muted/40 cursor-pointer'
                    }`}
                  >
                    <span className="text-lg">{chain.icon}</span>
                    <span>{chain.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Amount (USD₮)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/50 focus:outline-none text-lg font-mono"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">USD₮</span>
              </div>
            </div>

            {/* Recipient */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/50 focus:outline-none text-sm font-mono"
                placeholder="0x... / T... / EQ... / bc1..."
              />
            </div>

            {/* Actions */}
            {status === 'idle' && (
              <Button onClick={fetchQuote} className="w-full" size="lg" disabled={!amount || !recipient}>
                <Fuel className="h-4 w-4 mr-2" />
                Get Bridge Quote
              </Button>
            )}

            {status === 'quoting' && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching quote...
              </Button>
            )}

            {status === 'confirming' && quote && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-muted/20 border border-border text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Fee</span>
                    <span className="font-mono">{quote.fee} wei</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bridge Fee</span>
                    <span className="font-mono">{quote.bridgeFee} wei</span>
                  </div>
                </div>
                <Button onClick={executeBridge} className="w-full" size="lg">
                  <Zap className="h-4 w-4 mr-2" />
                  Confirm Bridge
                </Button>
                <Button variant="outline" onClick={() => { setStatus('idle'); setQuote(null); }} className="w-full">
                  Cancel
                </Button>
              </div>
            )}

            {status === 'bridging' && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Bridging...
              </Button>
            )}

            {status === 'done' && (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                <p className="text-sm text-muted-foreground">Bridge submitted successfully!</p>
                {txHash && <p className="font-mono text-xs break-all text-primary">{txHash}</p>}
                <Button variant="outline" onClick={() => { setStatus('idle'); setQuote(null); setTxHash(''); }}>
                  Bridge More
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-3">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => setStatus('idle')}>
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Panel */}
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Supported Networks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">EVM Chains</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche', 'Celo', 'Berachain', 'Monad', 'Mantle', 'Ink'].map(name => (
                      <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Non-EVM Destinations</h4>
                  <div className="flex flex-wrap gap-2">
                    {['TON', 'TRON', 'Solana'].map(name => (
                      <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <p>Select source and destination chains</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <p>USDT0 wraps your USD₮ for cross-chain transfer via LayerZero</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
                <p>Tokens arrive on the destination chain — gas fees sponsored by paymaster on ERC-4337 accounts</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1">Gas-Free Creator Payouts</h4>
                  <p className="text-xs text-muted-foreground">
                    Flow uses ERC-4337 account abstraction and TRON gas-free APIs to pay creator
                    settlements without requiring creators to hold native gas tokens.
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
