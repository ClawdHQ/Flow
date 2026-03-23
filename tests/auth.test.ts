import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { Signer } from 'bip322-js';
import { getSecureRandomBytes, keyPairFromSeed, sign } from '@ton/crypto';

describe('AuthService', () => {
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `flow-auth-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env['DB_PATH'] = dbPath;
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-telegram-token';
    process.env['OPENROUTER_API_KEY'] = 'test-openrouter-key';
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    process.env['FLOW_PUBLIC_BASE_URL'] = 'http://localhost:3000';
    vi.resetModules();
  });

  afterEach(async () => {
    const dbModule = await import('../src/storage/db.js');
    dbModule.closeDb();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env['DB_PATH'];
  });

  it('verifies an EVM signed challenge and creates a session', async () => {
    const wallet = ethers.Wallet.createRandom();
    const { authService } = await import('../src/auth/service.js');

    const challenge = authService.createChallenge({
      family: 'evm',
      address: wallet.address,
      network: 'polygon',
      host: 'flow.local',
    });
    const signature = await wallet.signMessage(challenge.challenge);
    const session = authService.verifyChallenge({
      family: 'evm',
      address: wallet.address,
      network: 'polygon',
      signature,
      username: 'alice_evm',
    });

    expect(session.sessionToken).toBeTruthy();
    expect(session.username).toBe('alice_evm');
  });

  it('verifies a TRON signed challenge', async () => {
    const account = TronWeb.utils.accounts.generateAccount();
    const { authService } = await import('../src/auth/service.js');

    const challenge = authService.createChallenge({
      family: 'tron_gasfree',
      address: account.address.base58,
      network: 'tron',
      host: 'flow.local',
    });
    const signature = TronWeb.utils.message.signMessage(challenge.challenge, account.privateKey);
    const session = authService.verifyChallenge({
      family: 'tron_gasfree',
      address: account.address.base58,
      network: 'tron',
      signature,
      username: 'alice_tron',
    });

    expect(session.username).toBe('alice_tron');
  });

  it('verifies a BTC BIP-322 challenge', async () => {
    const privateKey = 'L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k';
    const address = 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l';
    const { authService } = await import('../src/auth/service.js');

    const challenge = authService.createChallenge({
      family: 'btc',
      address,
      network: 'bitcoin',
      host: 'flow.local',
    });
    const signature = Signer.sign(privateKey, address, challenge.challenge);
    const session = authService.verifyChallenge({
      family: 'btc',
      address,
      network: 'bitcoin',
      signature,
      username: 'alice_btc',
    });

    expect(session.username).toBe('alice_btc');
  });

  it('verifies a TON proof bound to the issued nonce', async () => {
    const { authService, buildTonProofMessage } = await import('../src/auth/service.js');
    const keyPair = keyPairFromSeed(await getSecureRandomBytes(32));
    const address = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG';

    const challenge = authService.createChallenge({
      family: 'ton_gasless',
      address,
      network: 'ton',
      host: 'flow.local',
    });

    const proof = {
      timestamp: Math.floor(Date.now() / 1000),
      domain: { value: 'flow.local' },
      payload: challenge.nonce,
      signature: '',
    };
    const message = buildTonProofMessage(address, proof);
    proof.signature = Buffer.from(sign(Buffer.from(message), keyPair.secretKey)).toString('base64');

    const session = authService.verifyChallenge({
      family: 'ton_gasless',
      address,
      network: 'ton',
      username: 'alice_ton',
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      tonProof: proof,
    });

    expect(session.username).toBe('alice_ton');
  });
});
