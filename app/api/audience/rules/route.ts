import { NextRequest, NextResponse } from 'next/server';

/**
 * GET  /api/audience/rules          – list viewer's auto-tip rules
 * POST /api/audience/rules          – upsert a rule
 * DELETE /api/audience/rules?id=xx  – remove a rule
 */

function getToken(req: NextRequest): string | undefined {
  const h = req.headers.get('authorization') ?? req.headers.get('x-flow-session') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : h || undefined;
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { isSupabaseConfigured, sbFindMany } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const rules = await sbFindMany('auto_tip_rules', { viewer_id: session.address });
    return NextResponse.json({ rules });
  }

  const { AutoTipRulesRepository } = await import('@/server/storage/repositories/auto-tip-rules');
  const repo = new AutoTipRulesRepository();
  const rules = repo.findByViewer(session.address);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    creatorId?: string;
    budgetPerDayUsdt?: string;
    tipOnHalfWatch?: string;
    tipOnComplete?: string;
    chain?: string;
    enabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    creatorId,
    budgetPerDayUsdt = '5.0',
    tipOnHalfWatch = '0.10',
    tipOnComplete = '0.25',
    chain = (({ evm: 'polygon', evm_erc4337: 'polygon', tron_gasfree: 'tron', btc: 'bitcoin', ton: 'ton', ton_gasless: 'ton' } as Record<string, string>)[session.family] ?? session.family),
    enabled = true,
  } = body;

  // Convert display USDT to base-unit strings
  const toBase = (v: string) =>
    BigInt(Math.round(parseFloat(v) * 1_000_000)).toString();

  const record = {
    viewer_id: session.address,
    creator_id: creatorId ?? null,
    budget_per_day_base: toBase(budgetPerDayUsdt),
    tip_on_half_watch: toBase(tipOnHalfWatch),
    tip_on_complete: toBase(tipOnComplete),
    token: 'USDT',
    chain,
    enabled: enabled ? 1 : 0,
    updated_at: new Date().toISOString(),
  };

  const { isSupabaseConfigured, sbUpsert } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const rule = await sbUpsert('auto_tip_rules', record, ['viewer_id', 'creator_id']);
    return NextResponse.json({ rule }, { status: 200 });
  }

  const { AutoTipRulesRepository } = await import('@/server/storage/repositories/auto-tip-rules');
  const repo = new AutoTipRulesRepository();
  const rule = repo.upsert({
    viewer_id: session.address,
    creator_id: creatorId,
    budget_per_day_base: toBase(budgetPerDayUsdt),
    tip_on_half_watch: toBase(tipOnHalfWatch),
    tip_on_complete: toBase(tipOnComplete),
    token: 'USDT',
    chain,
    enabled: enabled ? 1 : 0,
  });
  return NextResponse.json({ rule }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ruleId = req.nextUrl.searchParams.get('id');
  if (!ruleId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { isSupabaseConfigured, sbDelete, sbFindOne } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    // Ownership check
    const rule = await sbFindOne<{ viewer_id: string }>('auto_tip_rules', { id: ruleId });
    if (!rule || rule.viewer_id !== session.address) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await sbDelete('auto_tip_rules', { id: ruleId });
    return NextResponse.json({ success: true });
  }

  const { AutoTipRulesRepository } = await import('@/server/storage/repositories/auto-tip-rules');
  const repo = new AutoTipRulesRepository();
  const rule = repo.findById(ruleId);
  if (!rule || rule.viewer_id !== session.address) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  repo.delete(ruleId);
  return NextResponse.json({ success: true });
}
