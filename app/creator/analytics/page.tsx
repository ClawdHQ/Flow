'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { formatUsdtDisplay } from '@/lib/utils';

interface RoundPerf {
  round_number: number;
  status: string;
  total_direct_tips_base_units: string;
  total_matched_base_units: string;
  tipper_count: number;
  creator_count: number;
}

export default function CreatorAnalytics() {
  const [rounds, setRounds] = useState<RoundPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rounds').then(r => r.json())
      .then(data => setRounds(Array.isArray(data) ? data : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;

  const totalDirectTips = rounds.reduce((sum, r) => sum + BigInt(r.total_direct_tips_base_units || '0'), 0n);
  const totalMatched = rounds.reduce((sum, r) => sum + BigInt(r.total_matched_base_units || '0'), 0n);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground mt-1">Round-by-round performance overview</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <BarChart3 className="h-5 w-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{rounds.length}</div>
            <p className="text-xs text-muted-foreground">Total Rounds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <TrendingUp className="h-5 w-5 text-flow-cyan mb-2" />
            <div className="text-2xl font-bold">{formatUsdtDisplay(totalDirectTips.toString())}</div>
            <p className="text-xs text-muted-foreground">Total Direct Tips</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Users className="h-5 w-5 text-flow-emerald mb-2" />
            <div className="text-2xl font-bold">{formatUsdtDisplay(totalMatched.toString())}</div>
            <p className="text-xs text-muted-foreground">Total Matched</p>
          </CardContent>
        </Card>
      </div>

      {/* Round History */}
      <Card>
        <CardHeader>
          <CardTitle>Round History</CardTitle>
          <CardDescription>Performance across recent rounds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-2">Round</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Direct Tips</th>
                  <th className="text-right p-2">Matched</th>
                  <th className="text-right p-2">Tippers</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map(r => (
                  <tr key={r.round_number} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-2 font-mono">#{r.round_number}</td>
                    <td className="p-2">
                      <Badge variant={r.status === 'completed' ? 'success' : r.status === 'open' ? 'default' : 'warning'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">{formatUsdtDisplay(r.total_direct_tips_base_units || '0')}</td>
                    <td className="p-2 text-right font-mono">{formatUsdtDisplay(r.total_matched_base_units || '0')}</td>
                    <td className="p-2 text-right">{r.tipper_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
