import { NextRequest, NextResponse } from 'next/server';

async function getAuthService() {
  const { authService } = await import('@/server/auth/service');
  return authService;
}

const WALLET_FAMILIES = new Set(['evm', 'evm_erc4337', 'tron_gasfree', 'btc', 'ton', 'ton_gasless']);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const family = String(body.family ?? '').trim();
  const network = typeof body.network === 'string' ? body.network.trim() : undefined;
  const username = typeof body.username === 'string' ? body.username.trim() : undefined;
  const creatorId = typeof body.creatorId === 'string' ? body.creatorId.trim() : undefined;
  const seedPhrase = typeof body.seedPhrase === 'string' ? body.seedPhrase.trim() : '';

  if (!WALLET_FAMILIES.has(family)) {
    return NextResponse.json({ error: 'Unsupported wallet family' }, { status: 400 });
  }
  if (!seedPhrase) {
    return NextResponse.json({ error: 'seedPhrase is required' }, { status: 400 });
  }

  try {
    const authService = await getAuthService();
    const result = await authService.connectManagedWallet({
      family: family as 'evm' | 'evm_erc4337' | 'tron_gasfree' | 'btc' | 'ton' | 'ton_gasless',
      network,
      username: username || undefined,
      creatorId: creatorId || undefined,
      seedPhrase,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to connect wallet';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
