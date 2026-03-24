import { NextRequest, NextResponse } from 'next/server';

async function getAuthService() {
  const { authService } = await import('@/server/auth/service');
  return authService;
}

async function getCreatorsRepo() {
  const { CreatorsRepository } = await import('@/server/storage/repositories/creators');
  return new CreatorsRepository();
}

async function getCreatorAdminWalletsRepo() {
  const { CreatorAdminWalletsRepository } = await import('@/server/storage/repositories/creator-admin-wallets');
  return new CreatorAdminWalletsRepository();
}

function getToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const flowHeader = req.headers.get('x-flow-session');
  return flowHeader ?? undefined;
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  const authService = await getAuthService();
  const session = authService.getSession(token);

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const creatorsRepo = await getCreatorsRepo();
  const creator = creatorsRepo.findById(session.creator_id);
  const adminWalletsRepo = await getCreatorAdminWalletsRepo();
  const adminWallet = adminWalletsRepo.findByCreatorId(session.creator_id);

  return NextResponse.json({
    creator_id: session.creator_id,
    username: creator?.username,
    address: adminWallet?.address ?? session.address,
    family: adminWallet?.family ?? session.family,
    network: adminWallet?.network ?? 'polygon',
    expires_at: session.expires_at,
  });
}

export async function DELETE(request: NextRequest) {
  const token = getToken(request);
  if (token) {
    const authService = await getAuthService();
    authService.logout(token);
  }
  return NextResponse.json({ ok: true });
}
