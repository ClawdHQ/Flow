import { config } from '../config/index.js';
import { resolveSupportedChain } from '../wallet/addresses.js';
import { AutoTipExecutionsRepository, type AutoTipExecutionRecord } from '../storage/repositories/auto-tip-executions.js';
import { AutoTipRulesRepository } from '../storage/repositories/auto-tip-rules.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { RumbleCreatorLinksRepository } from '../storage/repositories/rumble-creator-links.js';
import { TipsRepository, type TipRecord } from '../storage/repositories/tips.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { CreatorWalletManager } from '../wallet/creator.js';
import { normalizeTokenAmountToUsdtBase } from '../tokens/pricing.js';
import { type SupportedToken } from '../tokens/index.js';
import type { WatchProgressEvent } from '../rumble/events.js';
import { SybilDetector } from './sybil.js';
import { logger } from '../utils/logger.js';

export interface AutoTipRule {
  viewerId: string;
  creatorId?: string;
  budgetPerDayUsdt: bigint;
  tipOnHalfWatch: bigint;
  tipOnComplete: bigint;
  token: SupportedToken;
  chain: string;
  enabled: boolean;
}

interface AutoTipAgentDependencies {
  autoTipRulesRepo?: AutoTipRulesRepository;
  executionsRepo?: AutoTipExecutionsRepository;
  rumbleLinksRepo?: RumbleCreatorLinksRepository;
  creatorsRepo?: CreatorsRepository;
  roundsRepo?: RoundsRepository;
  tipsRepo?: TipsRepository;
  creatorWallet?: CreatorWalletManager;
  sybilDetector?: SybilDetector;
  poolWalletFactory?: (chain: string) => Pick<PoolWalletManager, 'transferToken'>;
}

export class AutoTipAgent {
  private readonly autoTipRulesRepo: AutoTipRulesRepository;
  private readonly executionsRepo: AutoTipExecutionsRepository;
  private readonly rumbleLinksRepo: RumbleCreatorLinksRepository;
  private readonly creatorsRepo: CreatorsRepository;
  private readonly roundsRepo: RoundsRepository;
  private readonly tipsRepo: TipsRepository;
  private readonly creatorWallet: CreatorWalletManager;
  private readonly sybilDetector: SybilDetector;
  private readonly poolWalletFactory: (chain: string) => Pick<PoolWalletManager, 'transferToken'>;

  constructor(dependencies: AutoTipAgentDependencies = {}) {
    this.autoTipRulesRepo = dependencies.autoTipRulesRepo ?? new AutoTipRulesRepository();
    this.executionsRepo = dependencies.executionsRepo ?? new AutoTipExecutionsRepository();
    this.rumbleLinksRepo = dependencies.rumbleLinksRepo ?? new RumbleCreatorLinksRepository();
    this.creatorsRepo = dependencies.creatorsRepo ?? new CreatorsRepository();
    this.roundsRepo = dependencies.roundsRepo ?? new RoundsRepository();
    this.tipsRepo = dependencies.tipsRepo ?? new TipsRepository();
    this.creatorWallet = dependencies.creatorWallet ?? new CreatorWalletManager();
    this.sybilDetector = dependencies.sybilDetector ?? new SybilDetector();
    this.poolWalletFactory = dependencies.poolWalletFactory ?? (chain => new PoolWalletManager(resolveSupportedChain(chain)));
  }

  async handleWatchEvent(event: WatchProgressEvent): Promise<void> {
    const identity = this.rumbleLinksRepo.upsertIdentity(event.creator_id, event.creator_rumble_handle);
    if (!identity.creator_id) {
      logger.info({ creatorId: event.creator_id }, 'Skipping auto-tip for unlinked Rumble creator');
      return;
    }

    const creator = this.creatorsRepo.findById(identity.creator_id);
    const round = this.roundsRepo.findCurrent();
    if (!creator || !round) {
      return;
    }

    const rule = this.resolveRule(event.viewer_id, creator.id, creator.preferred_chain);
    if (!rule || !rule.enabled || rule.budgetPerDayUsdt <= 0n) {
      return;
    }

    const trigger = this.getTriggerKind(event, rule);
    if (!trigger || trigger.amount <= 0n) {
      return;
    }

    if (this.executionsRepo.wasExecuted(event.viewer_id, creator.id, event.video_id, event.session_id, trigger.kind)) {
      return;
    }

    const spend = await this.getViewerDailySpend(event.viewer_id);
    if (spend + trigger.amount > rule.budgetPerDayUsdt) {
      logger.info({ viewerId: event.viewer_id }, 'Auto-tip skipped because daily budget was exceeded');
      return;
    }

    const creatorWallet = await this.creatorWallet.getOrCreateWallet(creator.id);
    const txHash = await this.poolWalletFactory(creatorWallet.chain).transferToken(
      creatorWallet.address,
      trigger.amount,
      rule.token,
    );
    const normalizedAmount = await normalizeTokenAmountToUsdtBase(trigger.amount, rule.token);
    const tip = this.tipsRepo.create({
      tip_uuid: `auto-${event.event_id}-${trigger.kind}`,
      round_id: round.id,
      tipper_telegram_id: event.viewer_id,
      creator_id: creator.id,
      amount_usdt: normalizedAmount.toString(),
      amount_native: trigger.amount.toString(),
      effective_amount: normalizedAmount.toString(),
      chain: creatorWallet.chain,
      token: rule.token,
      source: 'auto_watch',
      external_event_id: event.event_id,
      external_actor_id: event.viewer_id,
      deposit_tx_hash: txHash,
      status: 'confirmed',
      sybil_weight: 1.0,
      sybil_flagged: 0,
      message: `Auto-tip fired at ${event.watch_percent}% watch`,
      confirmed_at: new Date().toISOString(),
    });

    await this.sybilDetector.analyzeTip(tip);
    this.executionsRepo.create({
      rule_id: rule.id === 'default' ? undefined : rule.id,
      viewer_id: event.viewer_id,
      creator_id: creator.id,
      video_id: event.video_id,
      session_id: event.session_id,
      trigger_kind: trigger.kind,
      event_id: event.event_id,
      amount_base: trigger.amount.toString(),
      token: rule.token,
      chain: creatorWallet.chain,
      watch_percent: event.watch_percent,
      tx_hash: txHash,
      round_id: round.id,
    });

    logger.info(
      {
        module: 'auto_tip',
        viewerId: event.viewer_id,
        creatorId: creator.id,
        amount: trigger.amount.toString(),
        watchPercent: event.watch_percent,
        txHash,
      },
      'Auto-tip executed'
    );
  }

  registerAutoTipRule(rule: AutoTipRule): AutoTipRule & { id: string } {
    if (rule.tipOnHalfWatch + rule.tipOnComplete > rule.budgetPerDayUsdt) {
      throw new Error('Daily budget must cover both configured watch milestones.');
    }

    const record = this.autoTipRulesRepo.upsert({
      viewer_id: rule.viewerId,
      creator_id: rule.creatorId,
      budget_per_day_base: rule.budgetPerDayUsdt.toString(),
      tip_on_half_watch: rule.tipOnHalfWatch.toString(),
      tip_on_complete: rule.tipOnComplete.toString(),
      token: rule.token,
      chain: rule.chain,
      enabled: rule.enabled ? 1 : 0,
    });

    return {
      id: record.id,
      viewerId: record.viewer_id,
      creatorId: record.creator_id,
      budgetPerDayUsdt: BigInt(record.budget_per_day_base),
      tipOnHalfWatch: BigInt(record.tip_on_half_watch),
      tipOnComplete: BigInt(record.tip_on_complete),
      token: record.token,
      chain: record.chain,
      enabled: record.enabled === 1,
    };
  }

  async getViewerDailySpend(viewerId: string): Promise<bigint> {
    return this.executionsRepo.getDailySpend(viewerId);
  }

  getViewerStats(viewerId: string): { spend: bigint; tipCount: number; creatorCount: number } {
    return this.executionsRepo.getViewerStats(viewerId);
  }

  private resolveRule(viewerId: string, creatorId: string, chain: string): (AutoTipRule & { id: string }) | null {
    const stored = this.autoTipRulesRepo.findByViewerAndCreator(viewerId, creatorId);
    if (stored) {
      return {
        id: stored.id,
        viewerId: stored.viewer_id,
        creatorId: stored.creator_id,
        budgetPerDayUsdt: BigInt(stored.budget_per_day_base),
        tipOnHalfWatch: BigInt(stored.tip_on_half_watch),
        tipOnComplete: BigInt(stored.tip_on_complete),
        token: stored.token,
        chain: stored.chain,
        enabled: stored.enabled === 1,
      };
    }

    if (!config.AUTO_TIP_ENABLED) {
      return null;
    }

    return {
      id: 'default',
      viewerId,
      creatorId,
      budgetPerDayUsdt: config.AUTO_TIP_DAILY_BUDGET,
      tipOnHalfWatch: config.AUTO_TIP_HALF_WATCH,
      tipOnComplete: config.AUTO_TIP_COMPLETE,
      token: 'USDT',
      chain,
      enabled: true,
    };
  }

  private getTriggerKind(
    event: WatchProgressEvent,
    rule: AutoTipRule & { id: string }
  ): { kind: AutoTipExecutionRecord['trigger_kind']; amount: bigint } | null {
    if (event.event_type === 'video.watch_completed' || event.watch_percent >= 80) {
      return { kind: 'complete', amount: rule.tipOnComplete };
    }
    if (event.watch_percent >= 50) {
      return { kind: 'half_watch', amount: rule.tipOnHalfWatch };
    }
    return null;
  }
}

export const autoTipAgent = new AutoTipAgent();
