'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Loader2 } from 'lucide-react';

interface PortalData {
  creator: { payout_address: string; preferred_chain: string };
  split: { creator_bps: number; pool_bps: number; protocol_bps: number } | null;
  payout: { address: string; network: string; token: string; family: string } | null;
  overlay: { theme: string; position: string; show_tip_alerts: number; show_pool_bar: number; show_leaderboard: number; accent_color: string; rumble_handle?: string } | null;
}

export default function CreatorSettings() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  // Form state
  const [payoutAddress, setPayoutAddress] = useState('');
  const [payoutNetwork, setPayoutNetwork] = useState('polygon');
  const [payoutToken, setPayoutToken] = useState('USDT');
  const [creatorBps, setCreatorBps] = useState(8500);
  const [poolBps, setPoolBps] = useState(1000);
  const [overlayTheme, setOverlayTheme] = useState('dark');
  const [showTipAlerts, setShowTipAlerts] = useState(true);
  const [showPoolBar, setShowPoolBar] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('flow_session');
    if (!token) return;
    fetch('/api/creator/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.payout) { setPayoutAddress(d.payout.address); setPayoutNetwork(d.payout.network); setPayoutToken(d.payout.token); }
        else if (d.creator) { setPayoutAddress(d.creator.payout_address); }
        if (d.split) { setCreatorBps(d.split.creator_bps); setPoolBps(d.split.pool_bps); }
        if (d.overlay) {
          setOverlayTheme(d.overlay.theme ?? 'dark');
          setShowTipAlerts(!!d.overlay.show_tip_alerts);
          setShowPoolBar(!!d.overlay.show_pool_bar);
          setShowLeaderboard(!!d.overlay.show_leaderboard);
        }
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('flow_session') : null;

  async function savePayout() {
    if (!token) return;
    setSaving('payout');
    await fetch('/api/creator/payout', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: payoutAddress, network: payoutNetwork, token: payoutToken, family: 'evm' }),
    });
    setSaving('');
  }

  async function saveSplit() {
    if (!token) return;
    setSaving('split');
    const protocolBps = 100;
    await fetch('/api/creator/splits', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_bps: creatorBps, pool_bps: poolBps, protocol_bps: protocolBps }),
    });
    setSaving('');
  }

  async function saveOverlay() {
    if (!token) return;
    setSaving('overlay');
    await fetch('/api/creator/overlay', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: overlayTheme, show_tip_alerts: showTipAlerts, show_pool_bar: showPoolBar, show_leaderboard: showLeaderboard,
      }),
    });
    setSaving('');
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your payout, splits, and OBS overlay</p>
      </div>

      {/* Payout Destination */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Destination</CardTitle>
          <CardDescription>Where your earnings are sent after each round</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Wallet Address</label>
            <input value={payoutAddress} onChange={e => setPayoutAddress(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0x..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Network</label>
              <select value={payoutNetwork} onChange={e => setPayoutNetwork(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {['polygon', 'ethereum', 'arbitrum', 'avalanche', 'celo', 'tron'].map(n => (
                  <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Token</label>
              <select value={payoutToken} onChange={e => setPayoutToken(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {['USDT', 'XAUT', 'USAT'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={savePayout} disabled={saving === 'payout'} size="sm">
            {saving === 'payout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Payout
          </Button>
        </CardContent>
      </Card>

      {/* Revenue Splits */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Splits</CardTitle>
          <CardDescription>How incoming tips are distributed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Creator %</label>
              <div className="flex items-center gap-2">
                <input type="range" min={5000} max={9900} step={100} value={creatorBps}
                  onChange={e => { setCreatorBps(Number(e.target.value)); setPoolBps(10000 - Number(e.target.value) - 100); }}
                  className="flex-1 accent-primary" />
                <Badge variant="default">{(creatorBps / 100).toFixed(0)}%</Badge>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Pool %</label>
              <Badge variant="outline">{(poolBps / 100).toFixed(0)}%</Badge>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Protocol %</label>
              <Badge variant="outline">1%</Badge>
            </div>
          </div>
          <Button onClick={saveSplit} disabled={saving === 'split'} size="sm">
            {saving === 'split' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Splits
          </Button>
        </CardContent>
      </Card>

      {/* OBS Overlay */}
      <Card>
        <CardHeader>
          <CardTitle>OBS Overlay</CardTitle>
          <CardDescription>Customize the streaming overlay for your channel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tip Alerts', checked: showTipAlerts, onChange: setShowTipAlerts },
              { label: 'Pool Bar', checked: showPoolBar, onChange: setShowPoolBar },
              { label: 'Leaderboard', checked: showLeaderboard, onChange: setShowLeaderboard },
            ].map(toggle => (
              <label key={toggle.label} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={toggle.checked} onChange={e => toggle.onChange(e.target.checked)}
                  className="rounded accent-primary" />
                <span className="text-sm">{toggle.label}</span>
              </label>
            ))}
          </div>
          <Button onClick={saveOverlay} disabled={saving === 'overlay'} size="sm">
            {saving === 'overlay' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Overlay
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
