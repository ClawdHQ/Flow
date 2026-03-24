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

    const settings = {
      creator_id: session.creator_id,
      rumble_handle: typeof body.rumble_handle === 'string' ? body.rumble_handle : undefined,
      theme: typeof body.theme === 'string' ? body.theme : undefined,
      position: typeof body.position === 'string' ? body.position : undefined,
      show_tip_alerts: body.show_tip_alerts === false ? 0 : 1,
      show_pool_bar: body.show_pool_bar === false ? 0 : 1,
      show_leaderboard: body.show_leaderboard === false ? 0 : 1,
      accent_color: typeof body.accent_color === 'string' ? body.accent_color : undefined,
    };

    let overlay: any;
    if (isSupabaseConfigured()) {
      overlay = await sbUpsert('creator_overlay_settings', settings, ['creator_id']);
    } else {
      const { CreatorOverlaySettingsRepository } = await import('@/server/storage/repositories/creator-overlay-settings');
      const repo = new CreatorOverlaySettingsRepository();
      overlay = repo.upsert(session.creator_id, settings);
    }
    return NextResponse.json(overlay);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save overlay settings' }, { status: 500 });
  }
}
