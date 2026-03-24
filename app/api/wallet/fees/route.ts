import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const chain = req.nextUrl.searchParams.get('chain') ?? 'polygon';
    const agentPort = process.env.AGENT_PORT ?? '3001';
    const res = await fetch(`http://localhost:${agentPort}/api/wallet/fees?chain=${chain}`);
    if (!res.ok) return NextResponse.json({ normal: '0', fast: '0' });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ normal: '0', fast: '0' });
  }
}
