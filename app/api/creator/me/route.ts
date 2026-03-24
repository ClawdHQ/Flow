import { NextRequest, NextResponse } from 'next/server';

function getToken(req: NextRequest): string | undefined {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : (req.headers.get('x-flow-session') ?? undefined);
}

async function getSession(req: NextRequest) {
  const { authService } = await import('@/server/auth/service');
  return authService.getSession(getToken(req));
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { CreatorsRepository } = await import('@/server/storage/repositories/creators');
  const { SplitsRepository } = await import('@/server/storage/repositories/splits');
  const { CreatorOverlaySettingsRepository } = await import('@/server/storage/repositories/creator-overlay-settings');
  const { PayoutDestinationsRepository } = await import('@/server/storage/repositories/payout-destinations');
  const { CreatorAdminWalletsRepository } = await import('@/server/storage/repositories/creator-admin-wallets');
  const { RoundsRepository } = await import('@/server/storage/repositories/rounds');
  const { TipsRepository } = await import('@/server/storage/repositories/tips');
  const { RumbleCreatorLinksRepository } = await import('@/server/storage/repositories/rumble-creator-links');

  const creatorsRepo = new CreatorsRepository();
  const creator = creatorsRepo.findById(session.creator_id);
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const splitsRepo = new SplitsRepository();
  const overlayRepo = new CreatorOverlaySettingsRepository();
  const payoutRepo = new PayoutDestinationsRepository();
  const adminWalletsRepo = new CreatorAdminWalletsRepository();
  const roundsRepo = new RoundsRepository();
  const tipsRepo = new TipsRepository();
  const rumbleLinksRepo = new RumbleCreatorLinksRepository();

  const currentRound = roundsRepo.findCurrent();
  const recentTips = currentRound ? tipsRepo.findByCreatorAndRound(creator.id, currentRound.id) : [];
  const rumbleLink = rumbleLinksRepo.findByCreatorId(creator.id);

  return NextResponse.json({
    creator,
    split: splitsRepo.findByCreatorId(session.creator_id),
    overlay: overlayRepo.findByCreatorId(session.creator_id),
    payout: payoutRepo.findByCreatorId(session.creator_id),
    adminWallet: adminWalletsRepo.findByCreatorId(session.creator_id),
    rumbleLink,
    recentTips: recentTips.slice(0, 50),
    rounds: roundsRepo.findAll(10),
  });
}
