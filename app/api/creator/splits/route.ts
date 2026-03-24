import { NextRequest, NextResponse } from 'next/server';

function getToken(req: NextRequest): string | undefined {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : (req.headers.get('x-flow-session') ?? undefined);
}

async function requireSession(req: NextRequest) {
  const { authService } = await import('@/server/auth/service');
  const session = authService.getSession(getToken(req));
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();

    const { SplitsRepository } = await import('@/server/storage/repositories/splits');
    const repo = new SplitsRepository();
    const split = repo.upsert({
      creator_id: session.creator_id,
      creator_bps: Number(body.creator_bps ?? 8500),
      pool_bps: Number(body.pool_bps ?? 1000),
      protocol_bps: Number(body.protocol_bps ?? 100),
      collaborators: JSON.stringify(Array.isArray(body.collaborators) ? body.collaborators : []),
    });
    return NextResponse.json(split);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save splits' }, { status: 500 });
  }
}
