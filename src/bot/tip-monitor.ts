import type { Bot } from 'grammy';
import { SybilDetector } from '../agent/sybil.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { EscrowWalletManager } from '../wallet/escrow.js';
import { logger } from '../utils/logger.js';

type TipDepositNotifier = (message: string) => Promise<void>;

const tipsRepo = new TipsRepository();
const escrowManager = new EscrowWalletManager();
const sybilDetector = new SybilDetector();
const activeTipMonitors = new Map<string, Promise<void>>();

async function notifyTipResult(notifier: TipDepositNotifier | undefined, message: string): Promise<void> {
  if (!notifier) return;
  try {
    await notifier(message);
  } catch (err) {
    logger.warn({ err }, 'Tip result notification failed');
  }
}

function createTipResultNotifier(bot: Bot | undefined, chatId: string | undefined): TipDepositNotifier | undefined {
  if (!bot || !chatId) {
    return undefined;
  }

  return async (message: string) => {
    await bot.api.sendMessage(chatId, message);
  };
}

async function handleConfirmedTip(tipId: string, notifier?: TipDepositNotifier): Promise<void> {
  const tip = tipsRepo.findById(tipId);
  if (!tip) {
    logger.warn({ tipId }, 'Confirmed tip could not be found for post-deposit processing');
    return;
  }
  if (tip.status === 'confirmed' || tip.status === 'settled') {
    return;
  }

  tipsRepo.update(tipId, {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  });

  try {
    const refreshedTip = tipsRepo.findById(tipId);
    if (!refreshedTip) {
      throw new Error(`Tip disappeared after confirmation: ${tipId}`);
    }

    const analysis = await sybilDetector.analyzeTip(refreshedTip);
    await notifyTipResult(
      notifier,
      `✅ Deposit confirmed!\n\nSybil weight: ${analysis.weight}\n` +
      (analysis.flagged ? `⚠️ Flagged: ${analysis.reasons.join(', ')}` : '✅ Clean'),
    );
  } catch (err) {
    logger.error({ err, tipId }, 'Sybil analysis after tip confirmation failed');
    await notifyTipResult(notifier, '✅ Deposit confirmed!');
  }
}

async function handleExpiredTip(tipId: string, notifier?: TipDepositNotifier): Promise<void> {
  const tip = tipsRepo.findById(tipId);
  if (!tip) {
    logger.warn({ tipId }, 'Expired tip could not be found for post-timeout processing');
    return;
  }
  if (tip.status !== 'pending' && tip.status !== 'pending_retry') {
    return;
  }

  tipsRepo.update(tipId, { status: 'expired' });
  await notifyTipResult(notifier, '❌ Deposit not received within 5 minutes. Tip expired.');
}

export async function watchTipDeposit(tipId: string, notifier?: TipDepositNotifier): Promise<void> {
  const existingMonitor = activeTipMonitors.get(tipId);
  if (existingMonitor) {
    return existingMonitor;
  }

  const monitor = escrowManager.confirmDeposit(tipId)
    .then(async confirmed => {
      if (confirmed) {
        await handleConfirmedTip(tipId, notifier);
        return;
      }

      await handleExpiredTip(tipId, notifier);
    })
    .catch(err => {
      logger.error({ err, tipId }, 'Tip confirmation error');
    })
    .finally(() => {
      activeTipMonitors.delete(tipId);
    });

  activeTipMonitors.set(tipId, monitor);
  return monitor;
}

export async function resumePendingTipConfirmations(bot?: Bot): Promise<void> {
  const pendingEscrows = escrowManager.findPending();
  if (pendingEscrows.length === 0) {
    return;
  }

  logger.info({ count: pendingEscrows.length }, 'Resuming pending escrow confirmations');

  for (const escrow of pendingEscrows) {
    const tip = tipsRepo.findById(escrow.tipId);
    const notifier = createTipResultNotifier(bot, escrow.chatId ?? tip?.tipper_telegram_id);
    void watchTipDeposit(escrow.tipId, notifier);
  }
}
