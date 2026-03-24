import { NextResponse } from 'next/server';

export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');
  const { baseUnitsToUsdt } = await import('@/server/utils/math');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();

    const { data: openRound } = await sb
      .from('rounds')
      .select('*')
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestRound } = await sb
      .from('rounds')
      .select('*')
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentRound = openRound ?? latestRound;
    if (!currentRound) {
      return NextResponse.json({ round: null, leaderboard: [] });
    }

    const { data: tips } = await sb
      .from('tips')
      .select('id, creator_id, tipper_telegram_id, amount_usdt, effective_amount')
      .eq('round_id', currentRound.id)
      .eq('status', 'confirmed');

    const tipRows = tips ?? [];
    let totalDirect = 0n;
    const tipperSet = new Set<string>();
    const creatorSet = new Set<string>();
    const byCreator = new Map<string, { total: bigint; uniqueTippers: Set<string> }>();

    for (const tip of tipRows) {
      const amount = BigInt(tip.amount_usdt ?? '0');
      const effective = BigInt(tip.effective_amount ?? tip.amount_usdt ?? '0');
      totalDirect += amount;
      tipperSet.add(String(tip.tipper_telegram_id ?? ''));
      creatorSet.add(String(tip.creator_id ?? ''));
      if (!byCreator.has(String(tip.creator_id))) {
        byCreator.set(String(tip.creator_id), { total: 0n, uniqueTippers: new Set<string>() });
      }
      const bucket = byCreator.get(String(tip.creator_id))!;
      bucket.total += effective;
      bucket.uniqueTippers.add(String(tip.tipper_telegram_id ?? ''));
    }

    const tipIds = tipRows.map(t => String(t.id));
    let sybilCount = 0;
    if (tipIds.length > 0) {
      const { count } = await sb
        .from('sybil_flags')
        .select('*', { count: 'exact', head: true })
        .in('tip_id', tipIds);
      sybilCount = count ?? 0;
    }

    const creatorIds = [...byCreator.keys()].filter(Boolean);
    let creatorNameMap = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators } = await sb
        .from('creators')
        .select('id, username')
        .in('id', creatorIds);
      creatorNameMap = new Map((creators ?? []).map(c => [String(c.id), String(c.username)]));
    }

    const leaderboard = [...byCreator.entries()]
      .map(([creatorId, stats]) => ({
        creator: creatorNameMap.get(creatorId) ?? creatorId,
        score: stats.total.toString(),
        total: baseUnitsToUsdt(stats.total),
        total_base_units: stats.total.toString(),
        unique_tippers: stats.uniqueTippers.size,
      }))
      .sort((a, b) => (BigInt(b.score) > BigInt(a.score) ? 1 : -1));

    const startedAt = Date.parse(String(currentRound.started_at));
    const closesAt = Number.isFinite(startedAt)
      ? new Date(startedAt + 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const secondsRemaining = closesAt
      ? Math.max(0, Math.floor((Date.parse(closesAt) - Date.now()) / 1000))
      : undefined;

    return NextResponse.json({
      round: {
        id: currentRound.id,
        round_number: currentRound.round_number,
        status: currentRound.status,
        started_at: currentRound.started_at,
        closes_at: closesAt,
        seconds_remaining: secondsRemaining,
        ended_at: currentRound.ended_at,
        matching_multiplier: Number(currentRound.matching_multiplier ?? 1),
        total_direct_tips: baseUnitsToUsdt(totalDirect),
        total_direct_tips_base_units: totalDirect.toString(),
        total_matched: baseUnitsToUsdt(BigInt(currentRound.total_matched ?? '0')),
        total_matched_base_units: String(currentRound.total_matched ?? '0'),
        pool_used: baseUnitsToUsdt(BigInt(currentRound.pool_used ?? '0')),
        pool_used_base_units: String(currentRound.pool_used ?? '0'),
        tipper_count: tipperSet.size,
        creator_count: creatorSet.size,
        sybil_flags_count: sybilCount,
      },
      leaderboard,
    });
  }

  if (process.env['VERCEL']) {
    return NextResponse.json({ round: null, leaderboard: [] });
  }

  const { getCurrentRoundSnapshot, getRoundLeaderboardSnapshot } = await import('@/server/dashboard/data');
  const round = getCurrentRoundSnapshot();
  const leaderboard = getRoundLeaderboardSnapshot();
  return NextResponse.json({ round, leaderboard });
}
