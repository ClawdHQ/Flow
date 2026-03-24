import { NextResponse } from 'next/server';

export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');
  const { baseUnitsToUsdt } = await import('@/server/utils/math');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();

    const { data: snapshot } = await sb
      .from('pool_snapshots')
      .select('balance, multiplier')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: openRound } = await sb
      .from('rounds')
      .select('pool_used, total_matched')
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: rounds } = await sb
      .from('rounds')
      .select('pool_used')
      .limit(1000);

    const balance = BigInt(String(snapshot?.balance ?? '0'));
    const projectedPoolUsage = BigInt(String(openRound?.pool_used ?? openRound?.total_matched ?? '0'));
    const totalDistributed = (rounds ?? []).reduce(
      (sum, r) => sum + BigInt(String(r.pool_used ?? '0')),
      0n,
    );

    const roundsUntilDepletion = projectedPoolUsage > 0n
      ? Number(balance / projectedPoolUsage)
      : 999;

    return NextResponse.json({
      balance: baseUnitsToUsdt(balance),
      balance_base_units: balance.toString(),
      multiplier: Number(snapshot?.multiplier ?? 1),
      projectedPoolUsage: baseUnitsToUsdt(projectedPoolUsage),
      projectedPoolUsage_base_units: projectedPoolUsage.toString(),
      roundsUntilDepletion,
      totalDistributed: baseUnitsToUsdt(totalDistributed),
      totalDistributed_base_units: totalDistributed.toString(),
      chainBalances: [],
    });
  }

  if (process.env['VERCEL']) {
    return NextResponse.json({
      balance: '0.000000',
      balance_base_units: '0',
      multiplier: 1,
      projectedPoolUsage: '0.000000',
      projectedPoolUsage_base_units: '0',
      roundsUntilDepletion: 999,
      totalDistributed: '0.000000',
      totalDistributed_base_units: '0',
      chainBalances: [],
    });
  }

  const { getPoolSnapshot } = await import('@/server/dashboard/data');
  const pool = await getPoolSnapshot();
  return NextResponse.json(pool);
}
