import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST() {
  try {
    const seedPhrase = ethers.Wallet.createRandom().mnemonic?.phrase;
    if (!seedPhrase) {
      return NextResponse.json({ error: 'Unable to generate seed phrase' }, { status: 500 });
    }

    return NextResponse.json({ seedPhrase });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error generating seed phrase';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
