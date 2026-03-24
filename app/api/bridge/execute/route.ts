import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetChain, amount, recipient } = body;
    const sessionToken = req.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!targetChain || !amount || !recipient) {
      return NextResponse.json({ error: 'Missing required fields: targetChain, amount, recipient' }, { status: 400 });
    }

    const agentPort = process.env.AGENT_PORT ?? '3001';
    const res = await fetch(`http://localhost:${agentPort}/api/bridge/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ targetChain, amount, recipient }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bridge execution failed' }));
      return NextResponse.json(err, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: 'Bridge execution failed', detail: String(err) }, { status: 500 });
  }
}
