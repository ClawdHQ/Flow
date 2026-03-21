import { TipsRepository } from '../storage/repositories/tips.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { computeQuadraticScore } from '../quadratic/index.js';
import { PoolWalletManager } from '../wallet/pool.js';

export interface RoundStats {
  roundId: string;
  totalTips: number;
  totalDirectAmount: bigint;
  uniqueCreators: number;
  uniqueTippers: number;
}

const tipsRepo = new TipsRepository();
const roundsRepo = new RoundsRepository();
const poolWallet = new PoolWalletManager();

export class TipEvaluator {
  async evaluateTip(tipId: string): Promise<void> {
    const tip = tipsRepo.findById(tipId);
    if (!tip) throw new Error(`Tip not found: ${tipId}`);
    await this.getProjectedMatch(tip.creator_id);
    tipsRepo.update(tipId, { effective_amount: tip.amount_usdt });
  }

  async getProjectedMatch(creatorId: string): Promise<bigint> {
    const round = roundsRepo.findCurrent();
    if (!round) return 0n;
    const tips = tipsRepo.findConfirmedByRound(round.id)
      .filter(t => t.creator_id === creatorId);
    if (tips.length === 0) return 0n;
    const contributions = tips.map(t => BigInt(t.effective_amount));
    const score = computeQuadraticScore(contributions);
    const poolBalance = await poolWallet.getBalance();
    return poolBalance > 0n ? (poolBalance * score) / (score * 10n) : 0n;
  }

  async getRoundStats(roundId: string): Promise<RoundStats> {
    const tips = tipsRepo.findConfirmedByRound(roundId);
    const totalDirect = tips.reduce((s, t) => s + BigInt(t.amount_usdt), 0n);
    const creators = new Set(tips.map(t => t.creator_id));
    const tippers = new Set(tips.map(t => t.tipper_telegram_id));
    return {
      roundId,
      totalTips: tips.length,
      totalDirectAmount: totalDirect,
      uniqueCreators: creators.size,
      uniqueTippers: tippers.size,
    };
  }
}
