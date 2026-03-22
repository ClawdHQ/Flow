import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import {
  getCurrentRoundSnapshot,
  getCurrentRoundSybilFlags,
  getPoolSnapshot,
  getRecentRoundSnapshots,
  getRoundLeaderboardSnapshot,
} from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Read static dashboard HTML once at startup — no dynamic file access per request
const dashboardHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

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
  const round = getCurrentRoundSnapshot();
  res.json(round ?? { error: 'No active round' });
});

app.get('/api/round/leaderboard', dashRateLimit, (_req, res) => {
  res.json(getRoundLeaderboardSnapshot());
});

app.get('/api/pool', dashRateLimit, async (_req, res) => {
  const report = await getPoolSnapshot();
  res.json({
    balance: report.balance,
    multiplier: report.multiplier,
    roundsUntilDepletion: report.roundsUntilDepletion,
    totalDistributed: report.totalDistributed,
  });
});

app.get('/api/sybil/flags', dashRateLimit, (_req, res) => {
  res.json(getCurrentRoundSybilFlags());
});

app.get('/api/rounds', dashRateLimit, (_req, res) => {
  res.json(getRecentRoundSnapshots(20));
});

app.get('/', dashRateLimit, (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(dashboardHtml);
});

export function startDashboard(port: number): void {
  app.listen(port, () => {
    logger.info({ port }, 'Dashboard started');
  });
}

const port = parseInt(process.env['DASHBOARD_PORT'] ?? '3000', 10);
startDashboard(port);
