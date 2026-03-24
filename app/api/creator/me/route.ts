import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, sbFindOne } from '@/server/storage/supabase';

function getToken(req: NextRequest): string | undefined {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : (req.headers.get('x-flow-session') ?? undefined);
}

async function getSession(req: NextRequest) {
  const { authService } = await import('@/server/auth/service');
  return await authService.getSession(getToken(req));
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let creator: any = null;
  let split: any = null;
  let overlay: any = null;
  let payout: any = null;
  let adminWallet: any = null;
  let rumbleLink: any = null;
  let recentTips: any[] = [];
  let rounds: any[] = [];

  if (isSupabaseConfigured()) {
    creator = await sbFindOne('creators', { id: session.creator_id });
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    split = await sbFindOne('splits', { creator_id: session.creator_id });
    overlay = await sbFindOne('creator_overlay_settings', { creator_id: session.creator_id });
    payout = await sbFindOne('payout_destinations', { creator_id: session.creator_id });
    adminWallet = await sbFindOne('creator_admin_wallets', { creator_id: session.creator_id });
    rumbleLink = await sbFindOne('rumble_creator_links', { creator_id: session.creator_id });
    // TODO: Add sbFindMany calls for recentTips and rounds if needed
  } else {
    const { CreatorsRepository } = await import('@/server/storage/repositories/creators');
    const { SplitsRepository } = await import('@/server/storage/repositories/splits');
    const { CreatorOverlaySettingsRepository } = await import('@/server/storage/repositories/creator-overlay-settings');
    const { PayoutDestinationsRepository } = await import('@/server/storage/repositories/payout-destinations');
    const { CreatorAdminWalletsRepository } = await import('@/server/storage/repositories/creator-admin-wallets');
    const { RoundsRepository } = await import('@/server/storage/repositories/rounds');
    const { TipsRepository } = await import('@/server/storage/repositories/tips');
    const { RumbleCreatorLinksRepository } = await import('@/server/storage/repositories/rumble-creator-links');

    const creatorsRepo = new CreatorsRepository();
    creator = creatorsRepo.findById(session.creator_id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const splitsRepo = new SplitsRepository();
    const overlayRepo = new CreatorOverlaySettingsRepository();
    const payoutRepo = new PayoutDestinationsRepository();
    const adminWalletsRepo = new CreatorAdminWalletsRepository();
    const roundsRepo = new RoundsRepository();
    const tipsRepo = new TipsRepository();
    const rumbleLinksRepo = new RumbleCreatorLinksRepository();

    split = splitsRepo.findByCreatorId(session.creator_id);
    overlay = overlayRepo.findByCreatorId(session.creator_id);
    payout = payoutRepo.findByCreatorId(session.creator_id);
    adminWallet = adminWalletsRepo.findByCreatorId(session.creator_id);
    rumbleLink = rumbleLinksRepo.findByCreatorId(creator.id);

    const currentRound = roundsRepo.findCurrent();
    recentTips = currentRound ? tipsRepo.findByCreatorAndRound(creator.id, currentRound.id) : [];
    rounds = roundsRepo.findAll(10);
  }

  return NextResponse.json({
    creator,
    split,
    overlay,
    payout,
    adminWallet,
    rumbleLink,
    recentTips: recentTips.slice(0, 50),
    rounds,
  });
}
