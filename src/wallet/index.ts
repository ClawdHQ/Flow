import { ethers } from 'ethers';
import crypto from 'crypto';

export interface WalletInfo {
  address: string;
  hdPath: string;
  chain: string;
}

export interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
}

const POOL_PATH = "m/44'/60'/0'/0/0";
const CREATOR_BASE_PATH = "m/44'/60'/1'/0";
const ESCROW_BASE_PATH = "m/44'/60'/2'/0";

export class WalletManager {
  private masterNode: ethers.HDNodeWallet;
  private encryptionKey: Buffer;

  constructor() {
    const seedPhrase = process.env['WDK_SEED_PHRASE'] ?? ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
    const encKey = process.env['WDK_ENCRYPTION_KEY'] ?? 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(encKey.padEnd(32, '0').slice(0, 32), 'utf8');
    // Pass "m" as path to get the root HD node (depth 0), not the default BIP44 path (depth 5)
    this.masterNode = ethers.HDNodeWallet.fromPhrase(seedPhrase, undefined, 'm');
  }

  private deriveWallet(path: string): ethers.HDNodeWallet {
    return this.masterNode.derivePath(path);
  }

  async getPoolWallet(): Promise<WalletInfo> {
    const wallet = this.deriveWallet(POOL_PATH);
    return { address: wallet.address, hdPath: POOL_PATH, chain: 'polygon' };
  }

  async getCreatorWallet(creatorIndex: number): Promise<WalletInfo> {
    const path = `${CREATOR_BASE_PATH}/${creatorIndex}`;
    const wallet = this.deriveWallet(path);
    return { address: wallet.address, hdPath: path, chain: 'polygon' };
  }

  async createEscrowWallet(tipIndex: number): Promise<WalletInfo> {
    const path = `${ESCROW_BASE_PATH}/${tipIndex}`;
    const wallet = this.deriveWallet(path);
    return { address: wallet.address, hdPath: path, chain: 'polygon' };
  }

  async getBalance(_address: string, _chain: string): Promise<bigint> {
    // In production: query RPC for ERC-20 USDT balance
    return 0n;
  }

  async sendUSDT(_fromPath: string, _to: string, _amount: bigint, _chain: string): Promise<TransactionResult> {
    // In production: build + sign + broadcast ERC-20 transfer tx
    const mockHash = '0x' + crypto.randomBytes(32).toString('hex');
    return { txHash: mockHash, success: true };
  }

  async signMessage(hdPath: string, message: string): Promise<string> {
    const wallet = this.deriveWallet(hdPath);
    return wallet.signMessage(message);
  }

  async buildPoolTransaction(to: string, amount: bigint): Promise<{ unsignedTx: string; txHash: string }> {
    const unsignedTx = JSON.stringify({ to, amount: amount.toString(), nonce: Date.now() });
    const txHash = '0x' + crypto.createHash('sha256').update(unsignedTx).digest('hex');
    return { unsignedTx, txHash };
  }

  async executePoolTransaction(_unsignedTx: string, _agentSignature: string): Promise<TransactionResult> {
    const mockHash = '0x' + crypto.randomBytes(32).toString('hex');
    return { txHash: mockHash, success: true };
  }

  encryptKeyMaterial(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  decryptKeyMaterial(encrypted: string): string {
    const [ivHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex!, 'hex');
    const data = Buffer.from(dataHex!, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

export const walletManager: WalletManager = new WalletManager();
