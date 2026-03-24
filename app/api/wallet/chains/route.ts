import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const agentPort = process.env.AGENT_PORT ?? '3001';
    const res = await fetch(`http://localhost:${agentPort}/api/wallet/chains`);
    if (!res.ok) {
      return NextResponse.json({ chains: [], protocols: {} });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ chains: [], protocols: {} });
  }
}
