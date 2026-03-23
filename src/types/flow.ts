export type WalletFamily =
  | 'evm'
  | 'evm_erc4337'
  | 'tron_gasfree'
  | 'btc'
  | 'ton'
  | 'ton_gasless';

export type WalletRole = 'pool' | 'creator' | 'escrow' | 'admin';

export type RateSource = 'wdk_price_rates' | 'config_override' | 'demo_static';

export type AuthMethod = 'siwe' | 'tron_message' | 'bip322' | 'ton_proof';

export interface WalletCapabilitySet {
  live: boolean;
  sponsoredGas: boolean;
  gasless: boolean;
  bridgeable: boolean;
  chainNativeAuth: boolean;
  indexerBacked: boolean;
}

export interface CreatorAdminWallet {
  id?: string;
  creatorId: string;
  family: WalletFamily;
  network: string;
  address: string;
  auth_method: AuthMethod;
  public_key?: string;
  created_at?: string;
}

export interface PayoutDestination {
  id?: string;
  creatorId: string;
  family: WalletFamily;
  network: string;
  token: string;
  address: string;
  created_at?: string;
  updated_at?: string;
}

export interface RateSnapshot {
  id?: string;
  token: string;
  quoteToken: 'USDT';
  rate: string;
  source: RateSource;
  capturedAt: string;
}

export interface CanonicalSettlementSignatureSet {
  planHash: string;
  planSignature: string;
  reportCid?: string;
  cidSignature?: string;
}

export interface CanonicalSettlementAllocation {
  creatorId: string;
  creatorUsername: string;
  payoutAddress: string;
  payoutFamily: WalletFamily;
  payoutNetwork: string;
  payoutToken: string;
  directTips: string;
  matchAmount: string;
  score: string;
  uniqueTippers: number;
  settlementMode: 'direct' | 'bridge';
  bridgeActionId?: string;
  txHash?: string;
}

export interface CanonicalBridgeAction {
  id: string;
  creatorId: string;
  sourceNetwork: string;
  destinationNetwork: string;
  token: string;
  amount: string;
  status: 'planned' | 'approved' | 'submitted' | 'completed' | 'failed';
  approveHash?: string;
  hash?: string;
  resetAllowanceHash?: string;
}

export interface SettlementExecutionReceipt {
  allocationIndex: number;
  creatorId: string;
  mode: 'direct' | 'bridge';
  txHash?: string;
  approveHash?: string;
  resetAllowanceHash?: string;
  status: 'completed' | 'failed';
  error?: string;
}

export interface CanonicalSettlementPlan {
  roundId: string;
  roundNumber: number;
  computedAt: string;
  poolFamily: WalletFamily;
  poolNetwork: string;
  poolAddress: string;
  totalPool: string;
  totalMatched: string;
  allocations: CanonicalSettlementAllocation[];
  bridgeActions: CanonicalBridgeAction[];
  signatures: CanonicalSettlementSignatureSet;
  executionReceipts: SettlementExecutionReceipt[];
}

export type OverlayEventType =
  | 'tip'
  | 'milestone'
  | 'pool'
  | 'settlement'
  | 'presence';

export interface OverlayEventPayload {
  type: OverlayEventType;
  creatorHandle?: string;
  creatorId?: string;
  title: string;
  subtitle?: string;
  amount?: string;
  token?: string;
  txHash?: string;
  roundLabel?: string;
  supporters?: number;
  poolTotal?: string;
  matchTotal?: string;
  createdAt: string;
}

export interface AgentSkillInvocation {
  action: string;
  input: Record<string, unknown>;
}

export interface WalletAuthChallenge {
  family: WalletFamily;
  address: string;
  challenge: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  host: string;
}
