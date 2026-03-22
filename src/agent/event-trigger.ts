import { config } from '../config/index.js';
import { resolveSupportedChain } from '../wallet/addresses.js';
import { computeSplitBreakdown, getDefaultSplitConfig, type SplitConfig } from './splits.js';
import { CreatorWalletManager } from '../wallet/creator.js';
import { PoolWalletManager } from '../wallet/pool.js';
import { MilestoneBonusesRepository } from '../storage/repositories/milestone-bonuses.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { RumbleCreatorLinksRepository } from '../storage/repositories/rumble-creator-links.js';
import { SplitsRepository } from '../storage/repositories/splits.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { normalizeTokenAmountToUsdtBase } from '../tokens/pricing.js';
import { getTokenWeightMultiplier, type SupportedToken } from '../tokens/index.js';
import type { LivestreamMilestoneEvent, RumbleTipEvent, SuperChatEvent } from '../rumble/events.js';
import { SybilDetector } from './sybil.js';
import { logger } from '../utils/logger.js';

export interface MilestoneBonus {
  viewerCount: number;
  bonusUsdt: bigint;
}

export const DEFAULT_MILESTONES: MilestoneBonus[] = [
  { viewerCount: 100, bonusUsdt: 1_000_000n },
  { viewerCount: 500, bonusUsdt: 5_000_000n },
  { viewerCount: 1000, bonusUsdt: 10_000_000n },
  { viewerCount: 5000, bonusUsdt: 50_000_000n },
];

interface EventTriggerAgentDependencies {
  rumbleLinksRepo?: RumbleCreatorLinksRepository;
  creatorsRepo?: CreatorsRepository;
  roundsRepo?: RoundsRepository;
  tipsRepo?: TipsRepository;
  milestoneBonusesRepo?: MilestoneBonusesRepository;
  splitsRepo?: SplitsRepository;
  creatorWallet?: CreatorWalletManager;
  sybilDetector?: SybilDetector;
  poolWalletFactory?: (chain: string) => Pick<PoolWalletManager, 'getBalance' | 'transferToken'>;
}

export class EventTriggerAgent {
  private readonly rumbleLinksRepo: RumbleCreatorLinksRepository;
  private readonly creatorsRepo: CreatorsRepository;
  private readonly roundsRepo: RoundsRepository;
  private readonly tipsRepo: TipsRepository;
  private readonly milestoneBonusesRepo: MilestoneBonusesRepository;
  private readonly splitsRepo: SplitsRepository;
  private readonly creatorWallet: CreatorWalletManager;
  private readonly sybilDetector: SybilDetector;
  private readonly poolWalletFactory: (chain: string) => Pick<PoolWalletManager, 'getBalance' | 'transferToken'>;

  constructor(dependencies: EventTriggerAgentDependencies = {}) {
    this.rumbleLinksRepo = dependencies.rumbleLinksRepo ?? new RumbleCreatorLinksRepository();
    this.creatorsRepo = dependencies.creatorsRepo ?? new CreatorsRepository();
    this.roundsRepo = dependencies.roundsRepo ?? new RoundsRepository();
    this.tipsRepo = dependencies.tipsRepo ?? new TipsRepository();
    this.milestoneBonusesRepo = dependencies.milestoneBonusesRepo ?? new MilestoneBonusesRepository();
    this.splitsRepo = dependencies.splitsRepo ?? new SplitsRepository();
    this.creatorWallet = dependencies.creatorWallet ?? new CreatorWalletManager();
    this.sybilDetector = dependencies.sybilDetector ?? new SybilDetector();
    this.poolWalletFactory = dependencies.poolWalletFactory ?? (chain => new PoolWalletManager(resolveSupportedChain(chain)));
  }

  async handleMilestone(event: LivestreamMilestoneEvent): Promise<void> {
    if (!config.MILESTONE_BONUS_ENABLED || event.milestone_type !== 'viewer_count') {
      return;
    }
    if (this.milestoneBonusesRepo.findByEventId(event.event_id)) {
      return;
    }

    const milestone = DEFAULT_MILESTONES.find(entry => entry.viewerCount === event.milestone_value);
    if (!milestone) {
      return;
    }

    const creator = this.resolveLinkedCreator(event.creator_id, event.creator_rumble_handle);
    if (!creator) {
      logger.info({ creatorId: event.creator_id }, 'Skipping milestone bonus for unlinked Rumble creator');
      return;
    }

    const wallet = await this.creatorWallet.getOrCreateWallet(creator.id);
    const poolWallet = this.poolWalletFactory(wallet.chain);
    const poolBalance = await poolWallet.getBalance();
    if (poolBalance < milestone.bonusUsdt) {
      logger.warn({ creatorId: creator.id, bonus: milestone.bonusUsdt.toString() }, 'Skipping milestone bonus because pool balance is too low');
      return;
    }

    const txHash = await poolWallet.transferToken(wallet.address, milestone.bonusUsdt, 'USDT');
    this.milestoneBonusesRepo.create({
      creator_id: creator.id,
      event_id: event.event_id,
      milestone_value: event.milestone_value,
      bonus_amount: milestone.bonusUsdt.toString(),
      token: 'USDT',
      tx_hash: txHash,
    });

    logger.info(
      { creatorId: creator.id, milestone: event.milestone_value, txHash },
      'Milestone bonus released'
    );
  }

  async handleSuperChat(event: SuperChatEvent): Promise<void> {
    if (this.tipsRepo.findByExternalEventId(event.event_id)) {
      return;
    }
    const creator = this.resolveLinkedCreator(event.creator_id, event.creator_rumble_handle);
    const round = this.roundsRepo.findCurrent();
    if (!creator || !round) {
      return;
    }

    const normalizedAmount = BigInt(event.amount_usd_cents) * 10_000n;
    const weighted = this.applyTokenWeight(normalizedAmount, event.token);
    const split = this.getSplitConfig(creator.id);
    const breakdown = computeSplitBreakdown(normalizedAmount, split);
    const tip = this.tipsRepo.create({
      tip_uuid: `rumble-super-chat-${event.event_id}`,
      round_id: round.id,
      tipper_telegram_id: event.viewer_id,
      creator_id: creator.id,
      amount_usdt: normalizedAmount.toString(),
      amount_native: normalizedAmount.toString(),
      effective_amount: weighted.toString(),
      chain: creator.preferred_chain,
      token: event.token,
      source: 'rumble_super_chat',
      external_event_id: event.event_id,
      external_actor_id: event.viewer_id,
      status: 'confirmed',
      sybil_weight: 1.0,
      sybil_flagged: 0,
      message: event.message,
      confirmed_at: new Date().toISOString(),
    });

    await this.sybilDetector.analyzeTip(tip);
    logger.info(
      {
        creatorId: creator.id,
        eventId: event.event_id,
        token: event.token,
        creatorShare: breakdown.creatorAmount.toString(),
        poolShare: breakdown.poolAmount.toString(),
      },
      'Mirrored Rumble super chat into Flow ledger'
    );
  }

  async handleRumbleTip(event: RumbleTipEvent): Promise<void> {
    if (this.tipsRepo.findByExternalEventId(event.event_id)) {
      return;
    }
    const creator = this.resolveLinkedCreator(event.creator_id, event.creator_rumble_handle);
    const round = this.roundsRepo.findCurrent();
    if (!creator || !round) {
      return;
    }

    const nativeAmount = BigInt(event.amount_base_units);
    const normalizedAmount = await normalizeTokenAmountToUsdtBase(nativeAmount, event.token);
    const weighted = this.applyTokenWeight(normalizedAmount, event.token);
    const split = this.getSplitConfig(creator.id);
    const breakdown = computeSplitBreakdown(normalizedAmount, split);
    const tip = this.tipsRepo.create({
      tip_uuid: `rumble-tip-${event.event_id}`,
      round_id: round.id,
      tipper_telegram_id: event.viewer_id,
      creator_id: creator.id,
      amount_usdt: normalizedAmount.toString(),
      amount_native: nativeAmount.toString(),
      effective_amount: weighted.toString(),
      chain: creator.preferred_chain,
      token: event.token,
      source: 'rumble_native',
      external_event_id: event.event_id,
      external_actor_id: event.viewer_id,
      deposit_tx_hash: event.tx_hash,
      status: 'confirmed',
      sybil_weight: 1.0,
      sybil_flagged: 0,
      message: `Mirrored Rumble native tip from ${event.chain}`,
      confirmed_at: new Date().toISOString(),
    });

    await this.sybilDetector.analyzeTip(tip);
    logger.info(
      {
        creatorId: creator.id,
        eventId: event.event_id,
        token: event.token,
        creatorShare: breakdown.creatorAmount.toString(),
        poolShare: breakdown.poolAmount.toString(),
      },
      'Mirrored Rumble native tip into Flow ledger'
    );
  }

  configureSplit(creatorId: string, split: SplitConfig): SplitConfig {
    const record = this.splitsRepo.upsert({
      creator_id: creatorId,
      creator_bps: split.creatorBps,
      pool_bps: split.poolBps,
      protocol_bps: split.protocolBps,
      collaborators: JSON.stringify(split.collaborators ?? []),
    });
    return {
      creatorId: record.creator_id,
      creatorBps: record.creator_bps,
      poolBps: record.pool_bps,
      protocolBps: record.protocol_bps,
      collaborators: record.collaborators ? JSON.parse(record.collaborators) as SplitConfig['collaborators'] : [],
    };
  }

  private resolveLinkedCreator(rumbleCreatorId: string, rumbleHandle: string) {
    const identity = this.rumbleLinksRepo.upsertIdentity(rumbleCreatorId, rumbleHandle);
    if (!identity.creator_id) {
      return null;
    }
    return this.creatorsRepo.findById(identity.creator_id);
  }

  private getSplitConfig(creatorId: string): SplitConfig {
    const stored = this.splitsRepo.findByCreatorId(creatorId);
    if (!stored) {
      return getDefaultSplitConfig(creatorId);
    }
    return {
      creatorId,
      creatorBps: stored.creator_bps,
      poolBps: stored.pool_bps,
      protocolBps: stored.protocol_bps,
      collaborators: stored.collaborators ? JSON.parse(stored.collaborators) as SplitConfig['collaborators'] : [],
    };
  }

  private applyTokenWeight(amount: bigint, token: SupportedToken): bigint {
    return amount * BigInt(getTokenWeightMultiplier(token));
  }
}

export const eventTriggerAgent = new EventTriggerAgent();
