'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Waves,
  Wallet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

type Step = 'seed' | 'select' | 'connecting' | 'creating' | 'username' | 'done' | 'error';
type SeedMode = 'create' | 'import';

const SUPPORTED_WALLETS = [
  { family: 'evm', label: 'WDK EVM Wallet', network: 'polygon', icon: '⬡', description: 'Ethereum, Polygon, Arbitrum, Avalanche, Celo' },
  { family: 'tron_gasfree', label: 'WDK TRON Wallet', network: 'tron', icon: '⚡', description: 'TRON Network (Gasfree)' },
  { family: 'btc', label: 'WDK Bitcoin Wallet', network: 'bitcoin', icon: '₿', description: 'Bitcoin account via WDK wallet module' },
  { family: 'ton_gasless', label: 'WDK TON Wallet', network: 'ton', icon: '◈', description: 'TON Network (Gasless)' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('seed');
  const [seedMode, setSeedMode] = useState<SeedMode>('create');
  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [generatingSeed, setGeneratingSeed] = useState(false);
  const [error, setError] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [username, setUsername] = useState('');
  const [pendingConnect, setPendingConnect] = useState<{ family: string; network: string } | null>(null);

  useEffect(() => {
    const savedSeedPhrase = localStorage.getItem('flow_seed_phrase');
    if (!savedSeedPhrase) return;
    setSeedPhrase(savedSeedPhrase);
    setSeedConfirmed(true);
    setStep('select');
  }, []);

  const hasValidSeedPhrase = seedPhrase.trim().split(/\s+/).length >= 12;

  async function generateSeedPhrase() {
    setGeneratingSeed(true);
    setError('');
    try {
      const res = await fetch('/api/auth/seed', { method: 'POST' });
      const data = await res.json().catch(() => ({ error: 'Unable to parse seed endpoint response' }));
      if (!res.ok || !data.seedPhrase) {
        throw new Error(data.error ?? 'Unable to generate seed phrase');
      }
      setSeedPhrase(String(data.seedPhrase));
      setSeedConfirmed(false);
      setSeedMode('create');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate seed phrase');
      setStep('error');
    } finally {
      setGeneratingSeed(false);
    }
  }

  function continueToWalletSelection() {
    if (!hasValidSeedPhrase) {
      setError('Please provide a valid seed phrase.');
      setStep('error');
      return;
    }
    if (seedMode === 'create' && !seedConfirmed) {
      setError('Please confirm that you securely saved your seed phrase.');
      setStep('error');
      return;
    }
    localStorage.setItem('flow_seed_phrase', seedPhrase.trim().toLowerCase().replace(/\s+/g, ' '));
    setStep('select');
  }

  async function handleConnect(family: string, network: string) {
    setSelectedWallet(family);
    setStep('connecting');
    setError('');
    try {
      let cached: { creatorId?: string } | null = null;
      const cachedRaw = localStorage.getItem('flow_user');
      if (cachedRaw) {
        try { cached = JSON.parse(cachedRaw) as { creatorId?: string }; } catch { cached = null; }
      }
      setStep('creating');
      const connectRes = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, network, creatorId: cached?.creatorId, seedPhrase }),
      });
      if (!connectRes.ok) {
        const errData = await connectRes.json().catch(() => ({ error: 'Unable to connect wallet' }));
        const needsUsername =
          typeof errData.error === 'string' && errData.error.toLowerCase().includes('username');
        if (needsUsername) {
          setPendingConnect({ family, network });
          setStep('username');
          return;
        }
        throw new Error(errData.error ?? 'Unable to connect wallet');
      }
      const session = await connectRes.json();
      login(session.sessionToken, {
        creatorId: session.creatorId,
        username: session.username,
        address: session.address,
        family: session.family,
        network: session.network,
      });
      setStep('done');
      setTimeout(() => router.push('/creator'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStep('error');
    }
  }

  async function handleUsernameSubmit() {
    if (!username.trim() || !pendingConnect) {
      setError('Please enter a username.');
      setStep('error');
      return;
    }
    setStep('creating');
    setError('');
    try {
      const res = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family: pendingConnect.family,
          network: pendingConnect.network,
          username: username.trim(),
          seedPhrase,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unable to connect wallet' }));
        throw new Error(errData.error ?? 'Unable to connect wallet');
      }
      const session = await res.json();
      login(session.sessionToken, {
        creatorId: session.creatorId,
        username: session.username,
        address: session.address,
        family: session.family,
        network: session.network,
      });
      setStep('done');
      setTimeout(() => router.push('/creator'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStep('error');
    }
  }

  const stepTitle: Record<Step, string> = {
    seed: 'Create or Import Seed Phrase',
    select: 'Connect Your WDK Wallet',
    connecting: 'Connecting...',
    creating: 'Creating Session...',
    username: 'Choose a Username',
    done: 'Welcome to Flow!',
    error: 'Connection Failed',
  };

  const stepDescription: Record<Step, string> = {
    seed: 'You own your wallet by owning your seed phrase. Keep it safe and never share it.',
    select: 'Sign in with first-party WDK wallet connection to access the creator portal.',
    connecting: 'Preparing a secure wallet session...',
    creating: 'Setting up your session...',
    username: 'Pick a public display name for your new Flow creator account.',
    done: 'Redirecting to your creator portal...',
    error,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-flow-violet/10 blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-flow-cyan/10 blur-[80px]" />
      </div>

      <Card className="w-full max-w-lg glass">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Waves className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{stepTitle[step]}</CardTitle>
          <CardDescription>{stepDescription[step]}</CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {step === 'seed' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant={seedMode === 'create' ? 'default' : 'outline'} onClick={() => setSeedMode('create')} type="button">Create</Button>
                <Button variant={seedMode === 'import' ? 'default' : 'outline'} onClick={() => setSeedMode('import')} type="button">Import</Button>
              </div>

              {seedMode === 'create' && (
                <div className="space-y-3">
                  <Button onClick={generateSeedPhrase} className="w-full" type="button" disabled={generatingSeed}>
                    {generatingSeed ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Generate New Seed Phrase
                  </Button>
                  <textarea
                    value={seedPhrase}
                    readOnly
                    placeholder="Generate your seed phrase first"
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm min-h-24 font-mono"
                  />
                  <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={seedConfirmed} onChange={e => setSeedConfirmed(e.target.checked)} className="mt-0.5" />
                    I stored this seed phrase securely. I understand Flow cannot recover it for me.
                  </label>
                </div>
              )}

              {seedMode === 'import' && (
                <textarea
                  value={seedPhrase}
                  onChange={e => setSeedPhrase(e.target.value)}
                  placeholder="Enter your existing 12-24 word seed phrase"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm min-h-24 font-mono"
                />
              )}

              <Button onClick={continueToWalletSelection} className="w-full" type="button">
                Continue to Wallet Selection
              </Button>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-3">
              {SUPPORTED_WALLETS.map(wallet => (
                <button
                  key={wallet.family}
                  onClick={() => handleConnect(wallet.family, wallet.network)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all duration-200 text-left group cursor-pointer"
                >
                  <span className="text-2xl">{wallet.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">{wallet.label}</div>
                    <div className="text-xs text-muted-foreground">{wallet.description}</div>
                  </div>
                  <Wallet className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setStep('seed')} type="button">
                Back to Seed Phrase
              </Button>
            </div>
          )}

          {step === 'username' && (
            <div className="space-y-4">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your_username"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUsernameSubmit()}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('select')} className="flex-1" type="button">Back</Button>
                <Button onClick={handleUsernameSubmit} className="flex-1" type="button" disabled={!username.trim()}>Create Account</Button>
              </div>
            </div>
          )}

          {(step === 'connecting' || step === 'creating') && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <Badge variant="outline" className="px-3 py-1">{selectedWallet}</Badge>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <Button variant="outline" onClick={() => setStep('select')}>Try Again</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
