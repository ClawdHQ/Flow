import { NextResponse } from 'next/server';

export async function GET() {
  const { getRecentRumbleEvents } = await import('@/server/dashboard/data');
  return NextResponse.json({ events: getRecentRumbleEvents(50) });
}
