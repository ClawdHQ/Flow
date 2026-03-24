import { NextResponse } from 'next/server';

export async function GET() {
  const { getPoolSnapshot } = await import('@/server/dashboard/data');
  const pool = await getPoolSnapshot();
  return NextResponse.json(pool);
}
