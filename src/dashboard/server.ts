import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { TipsRepository } from '../storage/repositories/tips.js';
import { SybilFlagsRepository } from '../storage/repositories/sybil-flags.js';
import { PoolMonitor } from '../agent/pool-monitor.js';
import { computeQuadraticScore } from '../quadratic/index.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { baseUnitsToUsdt } from '../utils/math.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const roundsRepo = new RoundsRepository();
const tipsRepo = new TipsRepository();
const flagsRepo = new SybilFlagsRepository();
const creatorsRepo = new CreatorsRepository();
const poolMonitor = new PoolMonitor();

const dashRateMap = new Map<string, { count: number; resetAt: number }>();

function dashRateLimit(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = dashRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    dashRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  if (entry.count >= 60) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  entry.count++;
  next();
}

app.get('/api/round/current', dashRateLimit, (_req, res) => {
  const round = roundsRepo.findCurrent();
  res.json(round ?? { error: 'No active round' });
});

app.get('/api/round/leaderboard', dashRateLimit, (_req, res) => {
  const round = roundsRepo.findCurrent() ?? roundsRepo.findLatestCompleted();
  if (!round) { res.json([]); return; }
  const tips = tipsRepo.findConfirmedByRound(round.id);
  const byCreator = new Map<string, bigint[]>();
  for (const tip of tips) {
    if (!byCreator.has(tip.creator_id)) byCreator.set(tip.creator_id, []);
    byCreator.get(tip.creator_id)!.push(BigInt(tip.effective_amount));
  }
  const result = Array.from(byCreator.entries())
    .map(([id, contribs]) => {
      const creator = creatorsRepo.findById(id);
      return {
        creator: creator?.username ?? id,
        score: computeQuadraticScore(contribs).toString(),
        total: baseUnitsToUsdt(contribs.reduce((s, v) => s + v, 0n)),
      };
    })
    .sort((a, b) => (BigInt(b.score) > BigInt(a.score) ? 1 : -1));
  res.json(result);
});

app.get('/api/pool', dashRateLimit, async (_req, res) => {
  const report = await poolMonitor.generatePoolReport();
  res.json({
    balance: baseUnitsToUsdt(report.balance),
    multiplier: report.multiplier,
    roundsUntilDepletion: report.roundsUntilDepletion,
    totalDistributed: baseUnitsToUsdt(report.totalDistributedAllTime),
  });
});

app.get('/api/sybil/flags', dashRateLimit, (_req, res) => {
  const round = roundsRepo.findCurrent();
  if (!round) { res.json([]); return; }
  const flags = flagsRepo.findFlaggedByRound(round.id);
  res.json(flags);
});

app.get('/api/rounds', dashRateLimit, (_req, res) => {
  res.json(roundsRepo.findAll(20));
});

app.get('/', dashRateLimit, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

export function startDashboard(port: number): void {
  app.listen(port, () => {
    logger.info({ port }, 'Dashboard started');
  });
}

const port = parseInt(process.env['DASHBOARD_PORT'] ?? '3000', 10);
startDashboard(port);
