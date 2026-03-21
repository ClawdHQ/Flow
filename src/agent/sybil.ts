import Anthropic from '@anthropic-ai/sdk';
import { TipRecord, TipsRepository } from '../storage/repositories/tips.js';
import { SybilFlagsRepository } from '../storage/repositories/sybil-flags.js';
import { SYBIL_ANALYSIS_PROMPT } from './prompts.js';
import { logger } from '../utils/logger.js';

const tipsRepo = new TipsRepository();
const flagsRepo = new SybilFlagsRepository();

export interface SybilAnalysis {
  tipId: string;
  tipperId: string;
  flagScore: number;
  weight: number;
  flagged: boolean;
  reasons: string[];
  method: 'rule' | 'llm';
  analyzedAt: string;
}

export class SybilDetector {
  private client: Anthropic | null = null;
  private threshold: number;

  constructor() {
    this.threshold = parseFloat(process.env['SYBIL_WEIGHT_THRESHOLD'] ?? '0.7');
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey && apiKey !== 'test') {
      this.client = new Anthropic({ apiKey });
    }
  }

  async analyzeTip(tip: TipRecord): Promise<SybilAnalysis> {
    let flagScore = 0;
    const reasons: string[] = [];

    // Rule-based checks
    // Check velocity: tips to same creator this round
    const tipsToCreatorThisRound = tipsRepo.findByCreatorAndRound(tip.creator_id, tip.round_id)
      .filter(t => t.tipper_telegram_id === tip.tipper_telegram_id && t.id !== tip.id);
    if (tipsToCreatorThisRound.length >= 1) {
      flagScore += 0.4;
      reasons.push('Multiple tips to same creator this round');
    }

    // Check total tips this round
    const totalTipsThisRound = tipsRepo.findByTipperAndRound(tip.tipper_telegram_id, tip.round_id)
      .filter(t => t.id !== tip.id);
    if (totalTipsThisRound.length > 5) {
      flagScore += 0.2;
      reasons.push('High velocity: >5 tips in this round');
    }

    // Wallet age check (simulated - in production check chain)
    const createdAt = new Date(tip.created_at).getTime();
    const walletAge = Date.now() - createdAt;
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    if (walletAge < oneDay) {
      flagScore += 0.5;
      reasons.push('Wallet age < 1 day');
    } else if (walletAge < sevenDays) {
      flagScore += 0.3;
      reasons.push('Wallet age < 7 days');
    }

    let method: 'rule' | 'llm' = 'rule';
    let llmReasoning: string | undefined;

    // Use LLM for borderline cases
    if (flagScore >= 0.3 && flagScore < 0.65 && this.client) {
      try {
        const response = await this.client.messages.create({
          model: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514',
          max_tokens: 256,
          system: SYBIL_ANALYSIS_PROMPT,
          messages: [{
            role: 'user',
            content: JSON.stringify({
              flagScore,
              reasons,
              tipId: tip.id,
              tipperId: tip.tipper_telegram_id,
              amount: tip.amount_usdt,
              createdAt: tip.created_at,
            }),
          }],
        });
        const content = response.content[0];
        if (content && content.type === 'text') {
          const parsed = JSON.parse(content.text) as { confidence: number; reasoning: string; weight: number };
          flagScore = parsed.confidence;
          llmReasoning = parsed.reasoning;
          method = 'llm';
        }
      } catch (err) {
        logger.warn({ err }, 'LLM sybil analysis failed, using rule-based score');
      }
    }

    const flagged = flagScore >= this.threshold;
    const weight = flagged ? 0.1 : 1.0;

    // Store flag
    if (flagScore > 0 || flagged) {
      flagsRepo.create({
        tip_id: tip.id,
        flag_score: flagScore,
        weight,
        method,
        reasons: JSON.stringify(reasons),
        llm_reasoning: llmReasoning,
      });
    }

    // Update tip
    tipsRepo.update(tip.id, {
      sybil_weight: weight,
      sybil_flagged: flagged ? 1 : 0,
      sybil_reasons: reasons.length > 0 ? JSON.stringify(reasons) : undefined,
    });

    return {
      tipId: tip.id,
      tipperId: tip.tipper_telegram_id,
      flagScore,
      weight,
      flagged,
      reasons,
      method,
      analyzedAt: new Date().toISOString(),
    };
  }

  async batchAnalyzeRound(roundId: string): Promise<SybilAnalysis[]> {
    const tips = tipsRepo.findConfirmedByRound(roundId);
    return Promise.all(tips.map(tip => this.analyzeTip(tip)));
  }
}
