import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/audience/tip
 * Body: { creatorId: string; amount: string; chain?: string; message?: string }
 *
 * Creates a manual tip record in the current round tied to the authenticated
 * viewer's wallet address.  If Supabase is configured, it writes there;
 * otherwise it falls back to the SQLite repositories.
 *
 * The tip is created with status = "pending".  Actual on-chain settlement
 * is handled by the RoundManager agent during round close.
 */
export async function POST(req: NextRequest) {
  const h = req.headers.get('authorization') ?? req.headers.get('x-flow-session') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : h || undefined;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { creatorId?: string; amount?: string; chain?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const FAMILY_DEFAULT_CHAIN: Record<string, string> = {
    evm: 'polygon', evm_erc4337: 'polygon', tron_gasfree: 'tron', btc: 'bitcoin', ton: 'ton', ton_gasless: 'ton',
  };
  const defaultChain = FAMILY_DEFAULT_CHAIN[session.family] ?? session.family;
  const { creatorId, amount, chain = defaultChain, message } = body;

  if (!creatorId || !amount) {
    return NextResponse.json({ error: 'creatorId and amount are required' }, { status: 400 });
  }

  // Validate amount looks like a positive decimal
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number (e.g. "1.00")' }, { status: 400 });
  }

  // Convert USDT display to base units (6 decimals)
  const amountBase = BigInt(Math.round(parsed * 1_000_000)).toString();

  const { isSupabaseConfigured, sbInsert, sbFindOne } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    // --- Supabase path ---
    // Find current open round
    const round = await sbFindOne<{ id: string }>('rounds', { status: 'open' });
    if (!round) {
      return NextResponse.json({ error: 'No active round. Try again shortly.' }, { status: 409 });
    }

    // Verify creator exists
    const creator = await sbFindOne<{ id: string }>('creators', { id: creatorId });
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const tipUuid = uuidv4();
    const tip = await sbInsert('tips', {
      tip_uuid: tipUuid,
      round_id: round.id,
      tipper_telegram_id: session.address, // use wallet address as viewer identity
      tipper_wallet_address: session.address,
      creator_id: creatorId,
      amount_usdt: amountBase,
      effective_amount: amountBase,
      chain,
      token: 'USDT',
      amount_native: amountBase,
      source: 'manual_bot',
      status: 'pending',
      sybil_weight: 1.0,
      sybil_flagged: 0,
      message: message ?? undefined,
      creator_share: amountBase,
    });

    return NextResponse.json({ success: true, tip }, { status: 201 });
  }

  // --- SQLite fallback path ---
  const { RoundsRepository } = await import('@/server/storage/repositories/rounds');
  const { CreatorsRepository } = await import('@/server/storage/repositories/creators');
  const { TipsRepository } = await import('@/server/storage/repositories/tips');

  const roundsRepo = new RoundsRepository();
  const round = roundsRepo.findCurrent();
  if (!round) {
    return NextResponse.json({ error: 'No active round. Try again shortly.' }, { status: 409 });
  }

  const creatorsRepo = new CreatorsRepository();
  const creator = creatorsRepo.findById(creatorId);
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const tipsRepo = new TipsRepository();
  const tipUuid = uuidv4();
  const tip = tipsRepo.create({
    tip_uuid: tipUuid,
    round_id: round.id,
    tipper_telegram_id: session.address,
    tipper_wallet_address: session.address,
    creator_id: creatorId,
    amount_usdt: amountBase,
    effective_amount: amountBase,
    chain,
    token: 'USDT',
    amount_native: amountBase,
    source: 'manual_bot',
    status: 'pending',
    sybil_weight: 1.0,
    sybil_flagged: 0,
    message: message ?? undefined,
    creator_share: amountBase,
  });

  return NextResponse.json({ success: true, tip }, { status: 201 });
}

/**
 * GET /api/audience/tip?limit=20
 * Returns recent tips sent by the authenticated viewer.
 */
export async function GET(req: NextRequest) {
  const h = req.headers.get('authorization') ?? req.headers.get('x-flow-session') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : h || undefined;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 100);

  const { isSupabaseConfigured, sbFindMany } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const tips = await sbFindMany(
      'tips',
      { tipper_wallet_address: session.address },
      { orderBy: 'created_at', descending: true, limit },
    );
    return NextResponse.json({ tips });
  }

  const { TipsRepository } = await import('@/server/storage/repositories/tips');
  const tipsRepo = new TipsRepository();
  const tips = tipsRepo.findByTipper(session.address, limit);
  return NextResponse.json({ tips });
}
