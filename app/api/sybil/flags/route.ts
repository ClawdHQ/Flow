import { NextResponse } from 'next/server';

export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();

    const { data: round } = await sb
      .from('rounds')
      .select('id')
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!round?.id) return NextResponse.json([]);

    const { data: tips } = await sb
      .from('tips')
      .select('id')
      .eq('round_id', round.id);

    const tipIds = (tips ?? []).map(t => String(t.id));
    if (tipIds.length === 0) return NextResponse.json([]);

    const { data: flags } = await sb
      .from('sybil_flags')
      .select('id, tip_id, flag_score, confidence, weight, method, reasons')
      .in('tip_id', tipIds)
      .order('analyzed_at', { ascending: false });

    return NextResponse.json(flags ?? []);
  }

  if (process.env['VERCEL']) {
    return NextResponse.json([]);
  }

  const { getCurrentRoundSybilFlags } = await import('@/server/dashboard/data');
  return NextResponse.json(getCurrentRoundSybilFlags());
}
