import { CreatorsRepository } from '../storage/repositories/creators.js';
import { TelegramNotificationsRepository } from '../storage/repositories/telegram-notifications.js';
import { logger } from '../utils/logger.js';

const creatorsRepo = new CreatorsRepository();
const notificationsRepo = new TelegramNotificationsRepository();

export class SettlementNotifier {
  async notifyCreatorSettlement(params: {
    creatorId: string;
    roundId: string;
    txHash: string;
    reportUrl?: string;
  }): Promise<void> {
    const creator = creatorsRepo.findById(params.creatorId);
    if (!creator) return;

    const message = [
      `Flow settlement completed for ${creator.username}.`,
      `txHash: ${params.txHash}`,
      params.reportUrl ? `report: ${params.reportUrl}` : undefined,
    ].filter(Boolean).join('\n');

    notificationsRepo.create({
      creator_id: creator.id,
      round_id: params.roundId,
      telegram_id: creator.telegram_id,
      message,
      status: process.env['TELEGRAM_BOT_TOKEN'] ? 'queued' : 'demo',
      tx_hash: params.txHash,
      sent_at: process.env['TELEGRAM_BOT_TOKEN'] ? undefined : new Date().toISOString(),
    });

    logger.info({ creatorId: creator.id, txHash: params.txHash }, 'Settlement notification queued');
  }
}

export const settlementNotifier = new SettlementNotifier();
