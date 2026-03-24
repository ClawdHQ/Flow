import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceChain, targetChain, amount, recipient } = body;

    if (!sourceChain || !targetChain || !amount || !recipient) {
      return NextResponse.json({ error: 'Missing required fields: sourceChain, targetChain, amount, recipient' }, { status: 400 });
    }

    // Proxy to agent API
    const agentPort = process.env.AGENT_PORT ?? '3001';
    const res = await fetch(`http://localhost:${agentPort}/api/bridge/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceChain, targetChain, amount, recipient }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bridge quote failed' }));
      return NextResponse.json(err, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: 'Failed to get bridge quote', detail: String(err) }, { status: 500 });
  }
}
