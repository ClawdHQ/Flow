'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Timer,
  TrendingUp,
  Users,
  Shield,
  Coins,
  BarChart3,
  Clock,
} from 'lucide-react';
import { formatUsdtDisplay } from '@/lib/utils';

interface RoundSnapshot {
  id: string;
  round_number: number;
  status: string;
  started_at: string;
  closes_at?: string;
  seconds_remaining?: number;
  matching_multiplier: number;
  total_direct_tips: string;
  total_direct_tips_base_units: string;
  total_matched: string;
  total_matched_base_units: string;
  pool_used: string;
  pool_used_base_units: string;
  tipper_count: number;
  creator_count: number;
  sybil_flags_count: number;
}

interface LeaderboardEntry {
  creator: string;
  score: string;
  total: string;
  total_base_units: string;
  unique_tippers: number;
}

interface PoolSnapshot {
  balance: string;
  balance_base_units: string;
  multiplier: number;
  projectedPoolUsage: string;
  roundsUntilDepletion: number;
  totalDistributed: string;
  chainBalances: Array<{ chain: string; balance: string; balance_base_units: string }>;
}

interface SybilFlag {
  id: string;
  tip_id: string;
  flag_score: number;
  confidence?: number;
  weight: number;
  method: string;
  reasons: string;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function DashboardPage() {
  const [round, setRound] = useState<RoundSnapshot | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pool, setPool] = useState<PoolSnapshot | null>(null);
  const [sybilFlags, setSybilFlags] = useState<SybilFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [roundRes, poolRes, sybilRes] = await Promise.all([
          fetch('/api/round/current').then(r => r.json()),
          fetch('/api/pool').then(r => r.json()),
          fetch('/api/sybil/flags').then(r => r.json()),
        ]);
        setRound(roundRes.round);
        setLeaderboard(roundRes.leaderboard ?? []);
        setPool(poolRes);
        setSybilFlags(Array.isArray(sybilRes) ? sybilRes : []);
        setTimer(roundRes.round?.seconds_remaining ?? null);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer === null || timer <= 0) return;
    const id = setInterval(() => setTimer(t => (t && t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Real-time quadratic tipping overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Round</span>
              <Badge variant={round?.status === 'open' ? 'success' : 'default'} className="text-xs">
                {round?.status ?? 'N/A'}
              </Badge>
            </div>
            <div className="text-3xl font-bold">#{round?.round_number ?? '—'}</div>
            {timer !== null && timer > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Timer className="h-3 w-3" />
                <span className="font-mono">{formatTimer(timer)}</span>
                <span>remaining</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Direct Tips</span>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">
              {round ? formatUsdtDisplay(round.total_direct_tips_base_units) : '$0'}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {round?.tipper_count ?? 0} tippers
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> {round?.creator_count ?? 0} creators
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Pool Balance</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">
              {pool ? formatUsdtDisplay(pool.balance_base_units) : '$0'}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>{pool?.multiplier ?? 1}× multiplier</span>
              <span className="ml-2">{pool?.roundsUntilDepletion ?? '∞'} rounds left</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Sybil Flags</span>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{sybilFlags.length}</div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>this round</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quadratic Leaderboard
            </CardTitle>
            <CardDescription>
              Ranked by quadratic score — breadth of support matters more than depth
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No tips yet this round. Be the first supporter!
              </p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, i) => {
                  const maxScore = BigInt(leaderboard[0]?.score ?? '1');
                  const thisScore = BigInt(entry.score);
                  const pct = maxScore > 0n ? Number((thisScore * 100n) / maxScore) : 0;

                  return (
                    <div key={entry.creator} className="relative">
                      {/* Background bar */}
                      <div
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-transparent"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <div className="relative flex items-center justify-between p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-muted-foreground w-6">{i + 1}</span>
                          <div>
                            <span className="font-medium text-sm">{entry.creator}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {entry.unique_tippers} tippers
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-sm font-bold">{formatUsdtDisplay(entry.total_base_units)}</div>
                            <div className="text-xs text-muted-foreground">
                              Score: {Number(entry.score).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pool Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-flow-cyan" />
              Pool Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pool?.chainBalances?.map(cb => (
              <div key={cb.chain} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{cb.chain}</span>
                  <span className="font-mono">{formatUsdtDisplay(cb.balance_base_units)}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-flow-cyan to-flow-emerald rounded-full"
                    style={{
                      width: `${(() => {
                        const cbVal = parseFloat(cb.balance_base_units) || 0;
                        const poolVal = parseFloat(pool.balance_base_units) || 0;
                        return poolVal > 0 ? Math.max(Math.round((cbVal / poolVal) * 100), 1) : 0;
                      })()}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Total Distributed</span>
                <span className="font-mono">{pool ? formatUsdtDisplay(pool.totalDistributed ?? '0') : '$0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Multiplier</span>
                <Badge variant={pool?.multiplier === 2 ? 'success' : pool?.multiplier === 0.5 ? 'warning' : 'default'}>
                  {pool?.multiplier ?? 1}×
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sybil Flags */}
      {sybilFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              Sybil Flags
            </CardTitle>
            <CardDescription>Flagged tips with reduced quadratic weights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">Tip ID</th>
                    <th className="text-left p-2">Score</th>
                    <th className="text-left p-2">Weight</th>
                    <th className="text-left p-2">Method</th>
                    <th className="text-left p-2">Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {sybilFlags.map(flag => {
                    let reasons: string[] = [];
                    try { reasons = JSON.parse(flag.reasons); } catch { /* ignore */ }
                    return (
                      <tr key={flag.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{flag.tip_id.slice(0, 8)}</td>
                        <td className="p-2">
                          <Badge variant={flag.flag_score >= 0.7 ? 'destructive' : 'warning'}>
                            {flag.flag_score.toFixed(2)}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono">{flag.weight}×</td>
                        <td className="p-2">
                          <Badge variant={flag.method === 'llm' ? 'default' : 'outline'}>
                            {flag.method}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{reasons.join(', ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
