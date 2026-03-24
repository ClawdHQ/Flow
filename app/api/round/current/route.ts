import { NextResponse } from 'next/server';

export async function GET() {
  const { getCurrentRoundSnapshot, getRoundLeaderboardSnapshot } = await import('@/server/dashboard/data');
  const round = getCurrentRoundSnapshot();
  const leaderboard = getRoundLeaderboardSnapshot();
  return NextResponse.json({ round, leaderboard });
}
