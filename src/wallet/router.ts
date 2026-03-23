import { getPoolHomeChain, isBridgeEligibleChain, type SupportedChain } from '../config/chains.js';
import { logger } from '../utils/logger.js';

export interface FeeEstimate {
  gasFee: bigint;
  bridgeFee: bigint;
  netAmount: bigint;
  estimatedTimeSeconds: number;
  mode: 'direct' | 'bridge';
}

export interface RouteDecision {
  mode: 'direct' | 'bridge';
  fromChain: SupportedChain;
  toChain: SupportedChain;
}

export class ChainRouter {
  getSupportedChains(): SupportedChain[] {
    return ['polygon', 'arbitrum', 'ethereum', 'avalanche', 'celo', 'tron', 'bitcoin', 'ton'];
  }

  decideRoute(toChain: SupportedChain): RouteDecision {
    const fromChain = getPoolHomeChain();
    if (toChain === fromChain || !isBridgeEligibleChain(toChain)) {
      return { mode: 'direct', fromChain, toChain };
    }
    return { mode: 'bridge', fromChain, toChain };
  }

  async routePayment(from: string, to: string, amount: bigint, fromChain: SupportedChain, toChain: SupportedChain): Promise<string> {
    const decision = this.decideRoute(toChain);
    logger.info({ from, to, amount: amount.toString(), fromChain, toChain, decision }, 'Routing payment');
    return decision.mode === 'bridge'
      ? `bridge_${Date.now().toString(16)}`
      : `direct_${Date.now().toString(16)}`;
  }

  async estimateFees(fromChain: SupportedChain, toChain: SupportedChain, amount: bigint): Promise<FeeEstimate> {
    const decision = this.decideRoute(toChain);
    const gasFee = decision.mode === 'bridge' ? 5_000n : 1_000n;
    const bridgeFee = decision.mode === 'bridge' ? (amount * 5n) / 10000n : 0n;
    return {
      gasFee,
      bridgeFee,
      netAmount: amount > gasFee + bridgeFee ? amount - gasFee - bridgeFee : 0n,
      estimatedTimeSeconds: decision.mode === 'bridge' ? 300 : 5,
      mode: decision.mode,
    };
  }
}
