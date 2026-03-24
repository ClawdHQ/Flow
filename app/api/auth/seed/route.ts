import { NextResponse } from 'next/server';

async function getAuthServiceClass() {
  const { AuthService } = await import('@/server/auth/service');
  return AuthService;
}

export async function POST() {
  const AuthService = await getAuthServiceClass();
  return NextResponse.json({
    seedPhrase: AuthService.generateSeedPhrase(),
  });
}
