import { NextResponse } from 'next/server';

export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    const { data: events } = await sb
      .from('rumble_events')
      .select('event_id, event_type, creator_id, creator_handle, video_id, video_title, viewer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ events: events ?? [] });
  }

  if (process.env['VERCEL']) {
    return NextResponse.json({ events: [] });
  }

  const { getRecentRumbleEvents } = await import('@/server/dashboard/data');
  return NextResponse.json({ events: getRecentRumbleEvents(50) });
}
