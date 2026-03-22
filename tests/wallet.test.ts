import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';

describe('WalletManager', () => {
  async function loadWalletManager() {
    vi.resetModules();
    return (await import('../src/wallet/index.js')).WalletManager;
  }

  beforeEach(() => {
    process.env['WDK_SEED_PHRASE'] = 'test test test test test test test test test test test junk';
    process.env['WDK_ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-ok!!';
    delete process.env['USE_TESTNET'];
    delete process.env['ETHEREUM_RPC_URL'];
    delete process.env['ETHEREUM_SEPOLIA_RPC_URL'];
    delete process.env['ETHEREUM_SEPOLIA_USDT_ADDRESS'];
    delete process.env['POLYGON_RPC_URL'];
    delete process.env['POLYGON_AMOY_RPC_URL'];
    delete process.env['ARBITRUM_RPC_URL'];
    delete process.env['ARBITRUM_SEPOLIA_RPC_URL'];
    delete process.env['AVALANCHE_RPC_URL'];
    delete process.env['AVALANCHE_FUJI_RPC_URL'];
    delete process.env['AVALANCHE_FUJI_USDT_ADDRESS'];
    delete process.env['CELO_RPC_URL'];
    delete process.env['CELO_SEPOLIA_RPC_URL'];
    delete process.env['CELO_SEPOLIA_USDT_ADDRESS'];
    delete process.env['TRON_RPC_URL'];
    delete process.env['TRON_NILE_RPC_URL'];
  });

  it('derives pool wallet at correct HD path', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const poolWallet = await manager.getPoolWallet();
    expect(poolWallet.hdPath).toBe("m/44'/60'/0'/0/0");
    expect(ethers.isAddress(poolWallet.address)).toBe(true);
  });

  it('encrypts and decrypts key material', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const secret = 'my-secret-key-material';
    const encrypted = manager.encryptKeyMaterial(secret);
    const decrypted = manager.decryptKeyMaterial(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('derives different addresses for different creators', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const w0 = await manager.getCreatorWallet(0);
    const w1 = await manager.getCreatorWallet(1);
    expect(w0.address).not.toBe(w1.address);
  });

  it('derives wallets for additional EVM chains with chain-specific labels', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const ethereumWallet = await manager.getCreatorWallet(0, 'ethereum');
    const avalancheWallet = await manager.getCreatorWallet(0, 'avalanche');
    const celoWallet = await manager.getCreatorWallet(0, 'celo');

    expect(ethereumWallet.chain).toBe('ethereum');
    expect(avalancheWallet.chain).toBe('avalanche');
    expect(celoWallet.chain).toBe('celo');
    expect(ethereumWallet.hdPath).toBe("m/44'/60'/1'/0/0");
    expect(avalancheWallet.hdPath).toBe("m/44'/60'/1'/0/0");
    expect(celoWallet.hdPath).toBe("m/44'/60'/1'/0/0");
    expect(ethers.isAddress(ethereumWallet.address)).toBe(true);
    expect(ethers.isAddress(avalancheWallet.address)).toBe(true);
    expect(ethers.isAddress(celoWallet.address)).toBe(true);
  });

  it('derives tron wallets with the tron BIP-44 prefix', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const tronWallet = await manager.getCreatorWallet(2, 'tron');
    expect(tronWallet.chain).toBe('tron');
    expect(tronWallet.hdPath).toBe("m/44'/195'/1'/0/2");
    expect(TronWeb.isAddress(tronWallet.address)).toBe(true);
  });

  it('returns 0 in demo mode when no RPC provider is configured', async () => {
    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const poolWallet = await manager.getPoolWallet();
    await expect(manager.getBalance(poolWallet.address, poolWallet.chain, poolWallet.hdPath)).resolves.toBe(0n);
  });

  it('uses the provided HD path for balance lookups when direct ERC-20 reads fail', async () => {
    process.env['USE_TESTNET'] = 'true';
    process.env['POLYGON_AMOY_RPC_URL'] = 'https://rpc-amoy.polygon.technology';

    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const getEvmTokenBalance = vi.fn().mockRejectedValue(new Error('provider missing'));
    const deriveAccount = vi.fn().mockResolvedValue({
      getTokenBalance: vi.fn().mockRejectedValue(new Error('provider missing')),
    });
    (manager as unknown as {
      _getEvmTokenBalance: typeof getEvmTokenBalance;
    })._getEvmTokenBalance = getEvmTokenBalance;
    (manager as unknown as {
      _deriveAccount: typeof deriveAccount;
    })._deriveAccount = deriveAccount;

    await expect(
      manager.getBalance('0x1234567890123456789012345678901234567890', 'polygon', "m/44'/60'/1'/0/7")
    ).resolves.toBe(0n);

    expect(deriveAccount).toHaveBeenCalledWith('polygon', "1'/0/7");
  });

  it('prefers direct ERC-20 balance reads for EVM chains', async () => {
    process.env['USE_TESTNET'] = 'true';
    process.env['ETHEREUM_SEPOLIA_RPC_URL'] = 'https://eth-sepolia.example.invalid';

    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const getEvmTokenBalance = vi.fn().mockResolvedValue(1234567890n);
    const deriveAccount = vi.fn();
    (manager as unknown as {
      _getEvmTokenBalance: typeof getEvmTokenBalance;
    })._getEvmTokenBalance = getEvmTokenBalance;
    (manager as unknown as {
      _deriveAccount: typeof deriveAccount;
    })._deriveAccount = deriveAccount;

    await expect(
      manager.getBalance('0x1234567890123456789012345678901234567890', 'ethereum', "m/44'/60'/1'/0/7")
    ).resolves.toBe(1234567890n);

    expect(getEvmTokenBalance).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890', 'ethereum');
    expect(deriveAccount).not.toHaveBeenCalled();
  });

  it('uses the chain-specific transfer API for live-capable wallets', async () => {
    process.env['AVALANCHE_RPC_URL'] = 'https://api.avax.network/ext/bc/C/rpc';

    const WalletManager = await loadWalletManager();
    const manager = new WalletManager();
    const transfer = vi.fn().mockResolvedValue({ hash: '0xabc123' });
    const deriveAccount = vi.fn().mockResolvedValue({ transfer });
    const getTokenAddress = vi.fn().mockReturnValue('0x9702230A8EA53601f5cD2dc00fDBC13d4dF4A8c7');
    (manager as unknown as {
      _deriveAccount: typeof deriveAccount;
      _getTokenAddress: typeof getTokenAddress;
    })._deriveAccount = deriveAccount;
    (manager as unknown as {
      _getTokenAddress: typeof getTokenAddress;
    })._getTokenAddress = getTokenAddress;

    await expect(
      manager.sendUSDT("m/44'/60'/0'/0/9", '0x1234567890123456789012345678901234567890', 15n, 'avalanche')
    ).resolves.toEqual({ txHash: '0xabc123', success: true });

    expect(deriveAccount).toHaveBeenCalledWith('avalanche', "0'/0/9");
    expect(transfer).toHaveBeenCalledWith({
      token: '0x9702230A8EA53601f5cD2dc00fDBC13d4dF4A8c7',
      recipient: '0x1234567890123456789012345678901234567890',
      amount: 15n,
    });
  });
});
