'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Link2,
  Eye,
  Loader2,
  Copy,
  CheckCircle2,
  SendHorizonal,
  Repeat2,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface CreatorItem {
  id: string;
  username: string;
  preferred_chain: string;
}

interface TipRecord {
  id: string;
  creator_id: string;
  amount: string;
  chain: string;
  message?: string;
  status: string;
  created_at: string;
}

interface AutoTipRule {
  id: string;
  creator_id: string;
  half_watch_amount: string;
  complete_amount: string;
  daily_budget: string;
  enabled: boolean;
  created_at: string;
}

interface DepositInfo {
  depositAddress: string;
  family: string;
  network: string;
  supportedTokens: string[];
  moonpayUrl?: string;
  instructions: string[];
}

const CHAIN_META: Record<string, { icon: string; label: string }> = {
  ethereum: { icon: '⟠', label: 'Ethereum' },
  polygon: { icon: '⬡', label: 'Polygon' },
  arbitrum: { icon: '🔷', label: 'Arbitrum' },
  avalanche: { icon: '🔺', label: 'Avalanche' },
  celo: { icon: '🟡', label: 'Celo' },
  tron: { icon: '⚡', label: 'TRON' },
  bitcoin: { icon: '₿', label: 'Bitcoin' },
  ton: { icon: '💎', label: 'TON' },
};

type Tab = 'deposit' | 'tip' | 'rules' | 'overview';

export default function WalletPage() {
  const [tab, setTab] = useState<Tab>('deposit');

  // ── Shared ────────────────────────────────────────────────────────────────
  const [copiedAddr, setCopiedAddr] = useState('');

  function copy(addr: string) {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(''), 2000);
  }

  function authHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('flow_session') ?? sessionStorage.getItem('flow_session') ?? '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Deposit tab ───────────────────────────────────────────────────────────
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');

  const fetchDeposit = useCallback(async () => {
    setDepositLoading(true);
    setDepositError('');
    try {
      const res = await fetch('/api/audience/deposit', { headers: authHeader() });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setDeposit(await res.json());
    } catch (e: unknown) {
      setDepositError(e instanceof Error ? e.message : 'Failed to load deposit info');
    } finally {
      setDepositLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'deposit' && !deposit) fetchDeposit();
  }, [tab, deposit, fetchDeposit]);

  // ── Tip tab ───────────────────────────────────────────────────────────────
  const [creators, setCreators] = useState<CreatorItem[]>([]);
  const [tipCreatorId, setTipCreatorId] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [tipChain, setTipChain] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [tipSending, setTipSending] = useState(false);
  const [tipError, setTipError] = useState('');
  const [tipSuccess, setTipSuccess] = useState('');
  const [tipHistory, setTipHistory] = useState<TipRecord[]>([]);
  const [tipHistoryLoading, setTipHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchCreators = useCallback(async () => {
    try {
      const res = await fetch('/api/audience/creators', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchTipHistory = useCallback(async () => {
    setTipHistoryLoading(true);
    try {
      const res = await fetch('/api/audience/tip?limit=20', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setTipHistory(data.tips ?? []);
      }
    } catch { /* non-critical */ } finally {
      setTipHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tip' && creators.length === 0) fetchCreators();
    if (tab === 'tip') fetchTipHistory();
  }, [tab, creators.length, fetchCreators, fetchTipHistory]);

  async function sendTip() {
    setTipError('');
    setTipSuccess('');
    if (!tipCreatorId || !tipAmount) {
      setTipError('Select a creator and enter an amount.');
      return;
    }
    setTipSending(true);
    try {
      const res = await fetch('/api/audience/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          creatorId: tipCreatorId,
          amount: tipAmount,
          chain: tipChain || undefined,
          message: tipMessage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setTipSuccess(`Tip of ${tipAmount} USDT queued (id: ${data.tip?.id ?? '…'})`);
      setTipAmount('');
      setTipMessage('');
      fetchTipHistory();
    } catch (e: unknown) {
      setTipError(e instanceof Error ? e.message : 'Failed to send tip');
    } finally {
      setTipSending(false);
    }
  }

  // ── Auto-tip Rules tab ────────────────────────────────────────────────────
  const [rules, setRules] = useState<AutoTipRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleCreatorId, setRuleCreatorId] = useState('');
  const [ruleHalfWatch, setRuleHalfWatch] = useState('0.50');
  const [ruleComplete, setRuleComplete] = useState('1.00');
  const [ruleDailyBudget, setRuleDailyBudget] = useState('5.00');
  const [ruleSaving, setRuleSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      const res = await fetch('/api/audience/rules', { headers: authHeader() });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch (e: unknown) {
      setRulesError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'rules') {
      fetchRules();
      if (creators.length === 0) fetchCreators();
    }
  }, [tab, fetchRules, creators.length, fetchCreators]);

  async function saveRule() {
    setRulesError('');
    if (!ruleCreatorId) { setRulesError('Select a creator.'); return; }
    setRuleSaving(true);
    try {
      const res = await fetch('/api/audience/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          creatorId: ruleCreatorId,
          half_watch_amount: ruleHalfWatch,
          complete_amount: ruleComplete,
          daily_budget: ruleDailyBudget,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setShowAddRule(false);
      setRuleCreatorId('');
      fetchRules();
    } catch (e: unknown) {
      setRulesError(e instanceof Error ? e.message : 'Failed to save rule');
    } finally {
      setRuleSaving(false);
    }
  }

  async function toggleRule(rule: AutoTipRule) {
    try {
      await fetch('/api/audience/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          creatorId: rule.creator_id,
          half_watch_amount: rule.half_watch_amount,
          complete_amount: rule.complete_amount,
          daily_budget: rule.daily_budget,
          enabled: !rule.enabled,
        }),
      });
      fetchRules();
    } catch { /* non-critical */ }
  }

  async function deleteRule(id: string) {
    try {
      await fetch(`/api/audience/rules?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      setRules(prev => prev.filter(r => r.id !== id));
    } catch { /* non-critical */ }
  }

  // ── Overview tab state ────────────────────────────────────────────────────
  const [chains, setChains] = useState<string[]>([]);
  const [protocols, setProtocols] = useState<Record<string, string[]>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);

  const fetchChains = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/wallet/chains');
      const data = await res.json();
      setChains(data.chains ?? []);
      setProtocols(data.protocols ?? {});
    } catch {
      setChains(Object.keys(CHAIN_META));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'overview' && chains.length === 0) fetchChains();
  }, [tab, chains.length, fetchChains]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtAmount(raw: string) {
    const n = parseFloat(raw);
    return isNaN(n) ? raw : (n / 1_000_000).toFixed(2);
  }

  function creatorName(id: string) {
    return creators.find(c => c.id === id)?.username ?? id.slice(0, 8) + '…';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'deposit', label: 'Deposit', icon: <ArrowDownLeft className="h-4 w-4" /> },
    { key: 'tip', label: 'Send Tip', icon: <SendHorizonal className="h-4 w-4" /> },
    { key: 'rules', label: 'Auto-Tip', icon: <Repeat2 className="h-4 w-4" /> },
    { key: 'overview', label: 'Overview', icon: <Wallet className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10 max-w-4xl mx-auto">
      {/* Background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-[500px] h-[500px] rounded-full bg-violet-500/8 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/8 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Shield className="h-4 w-4" />
          Audience Hub
        </div>
        <h1 className="text-3xl font-bold mb-1">My Wallet</h1>
        <p className="text-muted-foreground text-sm">
          Deposit USDT, tip creators instantly, or set automatic tipping rules.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 mb-8 w-full">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── DEPOSIT TAB ── */}
      {tab === 'deposit' && (
        <div className="space-y-6">
          {depositLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {depositError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">{depositError}</CardContent>
            </Card>
          )}
          {deposit && (
            <>
              {/* Deposit address */}
              <Card className="glass border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4 text-primary" />
                    Your Deposit Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border/50 font-mono text-sm break-all">
                    <span className="flex-1">{deposit.depositAddress}</span>
                    <button
                      onClick={() => copy(deposit.depositAddress)}
                      className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                      title="Copy address"
                    >
                      {copiedAddr === deposit.depositAddress
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : <Copy className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{deposit.family}</Badge>
                    <Badge variant="outline">{deposit.network}</Badge>
                    {deposit.supportedTokens.map(t => (
                      <Badge key={t} variant="outline" className="border-emerald-500/30 text-emerald-400">{t}</Badge>
                    ))}
                  </div>
                  {deposit.instructions.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {deposit.instructions.map((ins, i) => <li key={i}>{ins}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* MoonPay buy card */}
              {deposit.moonpayUrl && (
                <Card className="glass border-violet-500/20">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold mb-1">Buy Crypto with Card</div>
                      <div className="text-sm text-muted-foreground">
                        Purchase USDT instantly via MoonPay — Visa, Mastercard, Apple Pay.
                      </div>
                    </div>
                    <Button
                      asChild
                      className="shrink-0 bg-violet-600 hover:bg-violet-700"
                    >
                      <a href={deposit.moonpayUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        Buy now <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {!depositLoading && !deposit && !depositError && (
            <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
              <Shield className="h-10 w-10 opacity-30" />
              <p className="text-sm">Sign in to view your deposit address.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SEND TIP TAB ── */}
      {tab === 'tip' && (
        <div className="space-y-6">
          <Card className="glass border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <SendHorizonal className="h-4 w-4 text-primary" />
                Send a Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Creator selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Creator</label>
                <div className="relative">
                  <select
                    value={tipCreatorId}
                    onChange={e => {
                      setTipCreatorId(e.target.value);
                      const c = creators.find(c => c.id === e.target.value);
                      if (c) setTipChain(c.preferred_chain);
                    }}
                    className="w-full appearance-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select a creator…</option>
                    {creators.map(c => (
                      <option key={c.id} value={c.id}>@{c.username}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (USDT)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="1.00"
                    value={tipAmount}
                    onChange={e => setTipAmount(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-muted/40 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  {['0.50', '1.00', '5.00', '10.00'].map(v => (
                    <button
                      key={v}
                      onClick={() => setTipAmount(v)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        tipAmount === v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chain */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chain</label>
                <div className="relative">
                  <select
                    value={tipChain}
                    onChange={e => setTipChain(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Default (creator preferred)</option>
                    {Object.entries(CHAIN_META).map(([id, m]) => (
                      <option key={id} value={id}>{m.icon} {m.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message <span className="normal-case text-muted-foreground/60">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Keep it up!"
                  maxLength={200}
                  value={tipMessage}
                  onChange={e => setTipMessage(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {tipError && <p className="text-destructive text-sm">{tipError}</p>}
              {tipSuccess && <p className="text-emerald-400 text-sm">{tipSuccess}</p>}

              <Button onClick={sendTip} disabled={tipSending} className="w-full">
                {tipSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
                {tipSending ? 'Sending…' : 'Send Tip'}
              </Button>
            </CardContent>
          </Card>

          {/* Tip history */}
          <div>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <Eye className="h-4 w-4" />
              Tip history
              <ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <Card className="glass">
                <CardContent className="p-0">
                  {tipHistoryLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : tipHistory.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No tips sent yet.</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {tipHistory.map(tip => (
                        <div key={tip.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <span className="font-medium">@{creatorName(tip.creator_id)}</span>
                            {tip.message && <span className="ml-2 text-muted-foreground">— {tip.message}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="font-mono text-emerald-400">${fmtAmount(tip.amount)}</span>
                            <Badge variant="outline" className="text-[10px]">{tip.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── AUTO-TIP RULES TAB ── */}
      {tab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Auto-Tip Rules</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically tip creators when you watch streams.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddRule(v => !v)} variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Add rule
            </Button>
          </div>

          {/* Add rule form */}
          {showAddRule && (
            <Card className="glass border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">New Auto-Tip Rule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Creator</label>
                  <div className="relative">
                    <select
                      value={ruleCreatorId}
                      onChange={e => setRuleCreatorId(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Select a creator…</option>
                      {creators.map(c => (
                        <option key={c.id} value={c.id}>@{c.username}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Half-watch (USDT)', val: ruleHalfWatch, set: setRuleHalfWatch },
                    { label: 'Full-watch (USDT)', val: ruleComplete, set: setRuleComplete },
                    { label: 'Daily budget (USDT)', val: ruleDailyBudget, set: setRuleDailyBudget },
                  ].map(f => (
                    <div key={f.label} className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={f.val}
                          onChange={e => f.set(e.target.value)}
                          className="w-full rounded-lg border border-border/60 bg-muted/40 pl-5 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {rulesError && <p className="text-destructive text-sm">{rulesError}</p>}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowAddRule(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveRule} disabled={ruleSaving}>
                    {ruleSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rules list */}
          {rulesLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rulesError && !showAddRule ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">{rulesError}</CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
              <Repeat2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No auto-tip rules yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <Card key={rule.id} className={`glass transition-all ${rule.enabled ? 'border-primary/20' : 'opacity-60'}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">@{creatorName(rule.creator_id)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                        <span>½-watch: <span className="text-foreground">${fmtAmount(rule.half_watch_amount)}</span></span>
                        <span>Full-watch: <span className="text-foreground">${fmtAmount(rule.complete_amount)}</span></span>
                        <span>Daily cap: <span className="text-foreground">${fmtAmount(rule.daily_budget)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleRule(rule)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          rule.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Non-custodial WDK wallet — BTC, EVM, ERC-4337, TON, TRON, and more. Managed by the agent runtime.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(chains.length > 0 ? chains : Object.keys(CHAIN_META))
                  .filter(c => !c.endsWith('_erc4337') && !c.endsWith('_gasfree') && !c.endsWith('_gasless'))
                  .map(chainId => {
                    const meta = CHAIN_META[chainId] ?? { icon: '🔗', label: chainId };
                    const chainProtocols = protocols[chainId] ?? [];
                    const hasGasfree = chains.includes(`${chainId}_gasfree`) || chains.includes(`${chainId}_gasless`);
                    const hasErc4337 = chains.includes(`${chainId}_erc4337`);
                    return (
                      <Card key={chainId} className="glass hover:border-primary/30 transition-all">
                        <CardContent className="p-4 flex items-center gap-3">
                          <span className="text-2xl">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{meta.label}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[10px] text-muted-foreground">Connected</span>
                              </div>
                              {hasGasfree && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 px-1.5 py-0">Gas-Free</Badge>}
                              {hasErc4337 && <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 px-1.5 py-0">ERC-4337</Badge>}
                              {chainProtocols.includes('usdt0') && <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 px-1.5 py-0">Bridge</Badge>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />Send</span>
                            <span className="flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />Receive</span>
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />Balance</span>
                            <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />Sign</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

