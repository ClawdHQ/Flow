import { NextResponse } from 'next/server';

export async function GET() {
  const { getRecentRoundSnapshots } = await import('@/server/dashboard/data');
  return NextResponse.json(getRecentRoundSnapshots(20));
}
