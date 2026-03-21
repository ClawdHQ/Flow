import { getDb } from '../storage/db.js';
import { walletManager } from '../wallet/index.js';
import { PoolMonitor } from './pool-monitor.js';
import { RoundManager } from './round-manager.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const roundsRepo = new RoundsRepository();
const poolMonitor = new PoolMonitor();
const roundManager = new RoundManager();

async function bootstrap(): Promise<void> {
  logger.info('🌊 FLOW agent starting...');

  // Init DB
  getDb();
  logger.info('Database initialized');

  // Ensure we have an open round
  if (!roundsRepo.findCurrent()) {
    const nextNumber = roundsRepo.getNextRoundNumber();
    roundsRepo.create(nextNumber);
    logger.info({ roundNumber: nextNumber }, 'Initial round created');
  }

  // Start services
  poolMonitor.start();
  roundManager.start();

  // Start bot if token is set
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (token && token.length > 1) {
    const { createBot } = await import('../bot/index.js');
    const bot = createBot(token);
    await bot.start();
    logger.info('Telegram bot started');
  } else {
    logger.warn('TELEGRAM_BOT_TOKEN not set, bot disabled');
  }

  logger.info('✅ FLOW agent running');
}

function shutdown(): void {
  logger.info('Shutting down...');
  poolMonitor.stop();
  roundManager.stop();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap().catch(err => {
  logger.error({ err }, 'Fatal error during bootstrap');
  process.exit(1);
});
