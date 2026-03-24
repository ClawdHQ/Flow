import { NextResponse } from 'next/server';

export async function GET() {
  const { getCurrentRoundSybilFlags } = await import('@/server/dashboard/data');
  return NextResponse.json(getCurrentRoundSybilFlags());
}
