import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    const chain = req.nextUrl.searchParams.get('chain');

    if (!address || !chain) {
      return NextResponse.json({ error: 'Missing address or chain' }, { status: 400 });
    }

    const agentPort = process.env.AGENT_PORT ?? '3001';
    const res = await fetch(`http://localhost:${agentPort}/api/wallet/balance?address=${address}&chain=${chain}`);
    if (!res.ok) {
      return NextResponse.json({ balance: '0' });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ balance: '0' });
  }
}
