import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  getCurrentRoundSnapshot,
  getCurrentRoundSybilFlags,
  getPoolSnapshot,
  getRecentRoundSnapshots,
  getRecentMilestoneBonuses,
  getRecentRumbleEvents,
  getRumbleAutoTipStats,
  getRumbleSummary,
  getRoundLeaderboardSnapshot,
} from './data.js';
import { rumbleWebhookRouter } from '../rumble/webhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createDashboardHtml(): string {
  return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
}

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

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!config.DASHBOARD_SECRET) {
    next();
    return;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader === `Bearer ${config.DASHBOARD_SECRET}`) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function createDashboardApp(): express.Express {
  const app = express();
  const dashboardHtml = createDashboardHtml();

  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));

  app.use('/rumble', rumbleWebhookRouter);

  app.get('/api/round/current', dashRateLimit, authenticate, (_req, res) => {
    const round = getCurrentRoundSnapshot();
    res.json(round ?? { error: 'No active round' });
  });

  app.get('/api/round/leaderboard', dashRateLimit, authenticate, (_req, res) => {
    res.json(getRoundLeaderboardSnapshot());
  });

  app.get('/api/pool', dashRateLimit, authenticate, async (_req, res) => {
    const report = await getPoolSnapshot();
    res.json(report);
  });

  app.get('/api/sybil/flags', dashRateLimit, authenticate, (_req, res) => {
    res.json(getCurrentRoundSybilFlags());
  });

  app.get('/api/rounds', dashRateLimit, authenticate, (_req, res) => {
    res.json(getRecentRoundSnapshots(20));
  });

  app.get('/api/rumble/events', dashRateLimit, authenticate, (_req, res) => {
    res.json({ events: getRecentRumbleEvents(50) });
  });

  app.get('/api/rumble/auto-tips', dashRateLimit, authenticate, (_req, res) => {
    res.json({
      summary: getRumbleSummary(),
      stats: getRumbleAutoTipStats(7),
    });
  });

  app.get('/api/rumble/milestones', dashRateLimit, authenticate, (_req, res) => {
    res.json({ milestones: getRecentMilestoneBonuses(20) });
  });

  app.get('/', dashRateLimit, (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHtml);
  });

  return app;
}

export function startDashboard(port: number): void {
  const app = createDashboardApp();
  app.listen(port, () => {
    logger.info({ port }, 'Dashboard started');
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDashboard(config.DASHBOARD_PORT);
}
