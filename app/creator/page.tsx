'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Coins,
  TrendingUp,
  Users,
  Settings,
  ArrowRight,
  Tv,
  CreditCard,
} from 'lucide-react';
import { formatUsdtDisplay, shortenAddress, timeAgo } from '@/lib/utils';

interface CreatorPortalData {
  creator: { id: string; username: string; payout_address: string; preferred_chain: string };
  split: { creator_bps: number; pool_bps: number; protocol_bps: number } | null;
  payout: { address: string; network: string; token: string } | null;
  adminWallet: { address: string; family: string; network: string } | null;
  rumbleLink: { rumble_handle: string } | null;
  recentTips: Array<{
    id: string; amount_usdt: string; tipper_telegram_id: string; created_at: string; status: string;
  }>;
  rounds: Array<{ round_number: number; status: string; total_matched: string }>;
}

export default function CreatorOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<CreatorPortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('flow_session');
    if (!token) return;
    fetch('/api/creator/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const totalTips = data?.recentTips
    .filter(t => t.status === 'confirmed' || t.status === 'settled')
    .reduce((sum, t) => sum + BigInt(t.amount_usdt), 0n) ?? 0n;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, <span className="gradient-text">{user?.username ?? 'Creator'}</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {data?.adminWallet ? shortenAddress(data.adminWallet.address) : 'Set up your payout address'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Coins className="h-5 w-5 text-primary" />
              <Badge variant="success">This Round</Badge>
            </div>
            <div className="text-2xl font-bold">{formatUsdtDisplay(totalTips.toString())}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.recentTips.length ?? 0} tips</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-flow-cyan" />
            </div>
            <div className="text-2xl font-bold">
              {data?.split ? `${(data.split.creator_bps / 100).toFixed(0)}%` : '85%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your split</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-flow-emerald" />
            </div>
            <div className="text-2xl font-bold">
              {new Set(data?.recentTips.map(t => t.tipper_telegram_id)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unique supporters</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/creator/settings', icon: Settings, label: 'Configure Splits & Payout', color: 'text-primary' },
          { href: '/creator/rumble', icon: Tv, label: 'Link Rumble Account', color: 'text-flow-cyan' },
          { href: '/creator/analytics', icon: TrendingUp, label: 'View Analytics', color: 'text-flow-emerald' },
          { href: '/creator/withdraw', icon: CreditCard, label: 'Withdraw Funds', color: 'text-flow-gold' },
        ].map(action => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full hover:border-primary/30 transition-colors cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-3">
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-sm font-medium group-hover:text-primary transition-colors flex-1">{action.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tips</CardTitle>
          <CardDescription>Tips received in the current round</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.recentTips.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No tips yet this round. Share your Rumble channel to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentTips.slice(0, 10).map(tip => (
                <div key={tip.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      tip.status === 'confirmed' ? 'success' :
                      tip.status === 'settled' ? 'default' :
                      tip.status === 'pending' ? 'warning' : 'outline'
                    }>
                      {tip.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(tip.created_at)}</span>
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {formatUsdtDisplay(tip.amount_usdt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
