'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, AlertCircle, ArrowUpRight } from 'lucide-react';
import { formatUsdtDisplay, shortenAddress } from '@/lib/utils';

export default function CreatorWithdraw() {
  const { user } = useAuth();
  const [payout, setPayout] = useState<{ address: string; network: string; token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('flow_session');
    if (!token) return;
    fetch('/api/creator/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setPayout(data.payout))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Withdraw</h2>
        <p className="text-muted-foreground mt-1">Withdraw your accumulated earnings</p>
      </div>

      {!payout ? (
        <Card className="border-amber-500/30">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-400">No payout destination configured</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please configure your payout address in Settings before withdrawing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payout Destination
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Address</span>
                <span className="font-mono text-sm">{shortenAddress(payout.address, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <Badge variant="outline" className="capitalize">{payout.network}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Token</span>
                <Badge>{payout.token}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accumulation Balance</CardTitle>
              <CardDescription>
                Funds are settled to your accumulation wallet at the end of each round.
                Withdrawal sends funds from your accumulation wallet to your payout address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Balance will appear here after your first completed round settlement.
                </p>
                <Button disabled className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
