'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tv, Link2, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface RumbleEvent {
  event_id: string;
  event_type: string;
  creator_handle: string;
  video_title?: string;
  created_at: string;
}

export default function CreatorRumble() {
  const [rumbleHandle, setRumbleHandle] = useState('');
  const [linked, setLinked] = useState(false);
  const [events, setEvents] = useState<RumbleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('flow_session');
    if (!token) return;

    Promise.all([
      fetch('/api/creator/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/rumble/events').then(r => r.json()),
    ]).then(([me, evts]) => {
      if (me.rumbleLink?.rumble_handle) {
        setRumbleHandle(me.rumbleLink.rumble_handle);
        setLinked(true);
      }
      if (me.overlay?.rumble_handle) {
        setRumbleHandle(me.overlay.rumble_handle);
        setLinked(true);
      }
      setEvents(evts.events ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function linkRumble() {
    const token = localStorage.getItem('flow_session');
    if (!token) return;
    setSaving(true);
    await fetch('/api/creator/overlay', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rumble_handle: rumbleHandle }),
    });
    setLinked(true);
    setSaving(false);
  }

  if (loading) return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rumble Integration</h2>
        <p className="text-muted-foreground mt-1">Connect your Rumble channel to enable auto-tips and milestone bonuses</p>
      </div>

      {/* Link Account */}
      <Card className={linked ? 'border-emerald-500/30' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Rumble Account
            {linked && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </CardTitle>
          <CardDescription>
            {linked ? 'Your Rumble account is linked' : 'Link your Rumble handle to start receiving auto-tips'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">rumble.com/</span>
              <input
                value={rumbleHandle}
                onChange={e => setRumbleHandle(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 pl-[100px] pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="YourChannelHandle"
              />
            </div>
            <Button onClick={linkRumble} disabled={saving || !rumbleHandle.trim()} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {linked ? 'Update' : 'Link'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Rumble Events</CardTitle>
          <CardDescription>Watch events, milestones, and super chats from your channel</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No Rumble events yet. Link your account and configure the webhook to get started.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.slice(0, 30).map(event => (
                <div key={event.event_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      event.event_type.includes('watch') ? 'default' :
                      event.event_type.includes('milestone') ? 'success' :
                      event.event_type.includes('super_chat') ? 'warning' : 'outline'
                    }>
                      {event.event_type.replace('video.', '').replace('livestream.', '')}
                    </Badge>
                    <div>
                      <span className="text-sm">{event.creator_handle}</span>
                      {event.video_title && (
                        <span className="text-xs text-muted-foreground ml-2">{event.video_title}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
