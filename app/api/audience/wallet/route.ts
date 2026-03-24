import { NextRequest, NextResponse } from 'next/server';

/** Returns the viewer's wallet info (address per chain) from their active session. */
export async function GET(req: NextRequest) {
  const h = req.headers.get('authorization') ?? req.headers.get('x-flow-session') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : h || undefined;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // derive deposit addresses for each supported chain family using the same
  // WDK wallet registered against this seed phrase.
  const agentPort = process.env.AGENT_PORT ?? '3001';

  // Try to get balances from the agent runtime
  const chainRes = await fetch(`http://localhost:${agentPort}/api/wallet/chains`).catch(() => null);
  const chainData = chainRes && chainRes.ok ? await chainRes.json().catch(() => null) : null;

  const FAMILY_DEFAULT_CHAIN: Record<string, string> = {
    evm: 'polygon', evm_erc4337: 'polygon', tron_gasfree: 'tron', btc: 'bitcoin', ton: 'ton', ton_gasless: 'ton',
  };
  return NextResponse.json({
    address: session.address,
    family: session.family,
    network: FAMILY_DEFAULT_CHAIN[session.family] ?? session.family,
    chains: chainData?.chains ?? [],
    protocols: chainData?.protocols ?? {},
  });
}
