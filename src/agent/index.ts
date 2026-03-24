import { getDb } from '../storage/db.js';
import { PoolMonitor } from './pool-monitor.js';
import { RoundManager } from './round-manager.js';
import { resumePendingTipConfirmations } from '../services/tip-monitor.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { startAgentApi } from '../server/api.js';
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

  // Resume pending tip confirmations
  await resumePendingTipConfirmations();

  // Start the agent API server (Rumble webhook + skill endpoints)
  const port = parseInt(process.env['AGENT_PORT'] ?? '3001', 10);
  startAgentApi(port);

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
