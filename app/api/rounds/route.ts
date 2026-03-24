import { NextResponse } from 'next/server';

export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');
  const { baseUnitsToUsdt } = await import('@/server/utils/math');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    const { data: rounds } = await sb
      .from('rounds')
      .select('*')
      .order('round_number', { ascending: false })
      .limit(20);

    const snapshots = (rounds ?? []).map(round => ({
      id: round.id,
      round_number: round.round_number,
      status: round.status,
      started_at: round.started_at,
      ended_at: round.ended_at,
      matching_multiplier: Number(round.matching_multiplier ?? 1),
      total_direct_tips: baseUnitsToUsdt(BigInt(String(round.total_direct_tips ?? '0'))),
      total_direct_tips_base_units: String(round.total_direct_tips ?? '0'),
      total_matched: baseUnitsToUsdt(BigInt(String(round.total_matched ?? '0'))),
      total_matched_base_units: String(round.total_matched ?? '0'),
      pool_used: baseUnitsToUsdt(BigInt(String(round.pool_used ?? '0'))),
      pool_used_base_units: String(round.pool_used ?? '0'),
      tipper_count: Number(round.tipper_count ?? 0),
      creator_count: Number(round.creator_count ?? 0),
      sybil_flags_count: Number(round.sybil_flags_count ?? 0),
    }));

    return NextResponse.json(snapshots);
  }

  if (process.env['VERCEL']) {
    return NextResponse.json([]);
  }

  const { getRecentRoundSnapshots } = await import('@/server/dashboard/data');
  return NextResponse.json(getRecentRoundSnapshots(20));
}
