import { describe, it, expect } from 'vitest';
import { WalletManager } from '../src/wallet/index.js';
import { ethers } from 'ethers';

describe('WalletManager', () => {
  it('derives pool wallet at correct HD path', async () => {
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    const manager = new WalletManager();
    const poolWallet = await manager.getPoolWallet();
    expect(poolWallet.hdPath).toBe("m/44'/60'/0'/0/0");
    expect(ethers.isAddress(poolWallet.address)).toBe(true);
  });

  it('encrypts and decrypts key material', () => {
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    const manager = new WalletManager();
    const secret = 'my-secret-key-material';
    const encrypted = manager.encryptKeyMaterial(secret);
    const decrypted = manager.decryptKeyMaterial(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('derives different addresses for different creators', async () => {
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    const manager = new WalletManager();
    const w0 = await manager.getCreatorWallet(0);
    const w1 = await manager.getCreatorWallet(1);
    expect(w0.address).not.toBe(w1.address);
  });
});
