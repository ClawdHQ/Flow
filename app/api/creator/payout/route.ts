import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, sbUpsert } from '@/server/storage/supabase';

function getToken(req: NextRequest): string | undefined {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : (req.headers.get('x-flow-session') ?? undefined);
}

async function requireSession(req: NextRequest) {
  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(getToken(req));
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();

    const data = {
      creator_id: session.creator_id,
      family: body.family ?? 'evm',
      network: String(body.network ?? 'polygon'),
      token: String(body.token ?? 'USDT'),
      address: String(body.address ?? ''),
    };

    let payout: any;
    if (isSupabaseConfigured()) {
      payout = await sbUpsert('payout_destinations', data, ['creator_id']);
    } else {
      const { PayoutDestinationsRepository } = await import('@/server/storage/repositories/payout-destinations');
      const repo = new PayoutDestinationsRepository();
      payout = repo.upsert({
        creatorId: data.creator_id,
        family: data.family,
        network: data.network,
        token: data.token,
        address: data.address,
      });
    }
    return NextResponse.json(payout);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save payout' }, { status: 500 });
  }
}
