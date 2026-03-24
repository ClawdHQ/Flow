import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
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
import { AuthService, authService } from '../auth/service.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { CreatorAdminWalletsRepository } from '../storage/repositories/creator-admin-wallets.js';
import { CreatorOverlaySettingsRepository } from '../storage/repositories/creator-overlay-settings.js';
import { PayoutDestinationsRepository } from '../storage/repositories/payout-destinations.js';
import { RoundAllocationsRepository } from '../storage/repositories/round-allocations.js';
import { ReportAttestationsRepository } from '../storage/repositories/report-attestations.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { RumbleCreatorLinksRepository } from '../storage/repositories/rumble-creator-links.js';
import { SplitsRepository } from '../storage/repositories/splits.js';
import { autoTipAgent } from '../agent/auto-tip.js';
import { eventTriggerAgent } from '../agent/event-trigger.js';
import { overlayHub } from '../realtime/overlay-hub.js';
import { requireX402 } from '../utils/x402.js';
import type { WalletFamily } from '../types/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
const publicRoot = path.join(projectRoot, 'public');

const creatorsRepo = new CreatorsRepository();
const creatorAdminWalletsRepo = new CreatorAdminWalletsRepository();
const creatorOverlaySettingsRepo = new CreatorOverlaySettingsRepository();
const payoutDestinationsRepo = new PayoutDestinationsRepository();
const roundAllocationsRepo = new RoundAllocationsRepository();
const reportAttestationsRepo = new ReportAttestationsRepository();
const roundsRepo = new RoundsRepository();
const rumbleLinksRepo = new RumbleCreatorLinksRepository();
const splitsRepo = new SplitsRepository();

function readHtml(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function loadPublicHtml(name: string): string {
  return readHtml(path.join(publicRoot, name));
}

function getSessionToken(req: express.Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  const flowHeader = req.headers['x-flow-session'];
  if (typeof flowHeader === 'string') {
    return flowHeader;
  }
  return undefined;
}

async function requireCreatorSession(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const session = await authService.getSession(getSessionToken(req));
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as express.Request & { flowSession?: any }).flowSession = session;
  next();
}

function resolveCreatorByHandle(handle: string) {
  const link = rumbleLinksRepo.findByHandle(handle) ?? null;
  if (link?.creator_id) {
    return creatorsRepo.findById(link.creator_id);
  }
  return creatorsRepo.findByUsername(handle);
}

function buildCreatorPortalPayload(creatorId: string) {
  const creator = creatorsRepo.findById(creatorId);
  if (!creator) return null;
  const split = splitsRepo.findByCreatorId(creatorId);
  const overlay = creatorOverlaySettingsRepo.findByCreatorId(creatorId);
  const payout = payoutDestinationsRepo.findByCreatorId(creatorId);
  const adminWallet = creatorAdminWalletsRepo.findByCreatorId(creatorId);
  const rounds = roundsRepo.findAll(10);
  return {
    creator,
    split,
    overlay,
    payout,
    adminWallet,
    rounds,
  };
}

function buildOverlayState(handle: string) {
  const creator = resolveCreatorByHandle(handle);
  const currentRound = getCurrentRoundSnapshot();
  const leaderboard = getRoundLeaderboardSnapshot();
  const creatorEntry = creator ? leaderboard.find(entry => entry.creator === creator.username) : null;
  const overlay = creator ? creatorOverlaySettingsRepo.findByCreatorId(creator.id) : null;
  return {
    handle,
    creator,
    overlay,
    round: currentRound,
    leaderboard: leaderboard.slice(0, 5),
    creatorEntry,
  };
}

export function createDashboardApp(): express.Express {
  const app = express();
  const dashboardHtml = readHtml(path.join(__dirname, 'index.html'));
  const landingHtml = loadPublicHtml('landing.html');
  const creatorHtml = loadPublicHtml('creator.html');
  const overlayHtml = loadPublicHtml('overlay.html');
  const presentHtml = loadPublicHtml('present.html');

  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));

  app.use('/rumble', rumbleWebhookRouter);

  app.post('/api/auth/seed', async (_req, res) => {
    res.json({
      seedPhrase: await authService.generateSeedPhrase(),
    });
  });

  app.post('/api/auth/connect', async (req, res) => {
    try {
      const family = String(req.body.family ?? '').trim() as WalletFamily;
      const result = await authService.connectManagedWallet({
        family,
        network: String(req.body.network ?? 'polygon'),
        username: typeof req.body.username === 'string' ? req.body.username : undefined,
        creatorId: typeof req.body.creatorId === 'string' ? req.body.creatorId : undefined,
        seedPhrase: String(req.body.seedPhrase ?? ''),
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to connect wallet';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/auth/logout', requireCreatorSession, async (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      await authService.logout(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/creator/me', requireCreatorSession, (req, res) => {
    const session = (req as express.Request & { flowSession?: { creator_id: string } }).flowSession;
    const payload = session ? buildCreatorPortalPayload(session.creator_id) : null;
    if (!payload) {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }
    res.json(payload);
  });

  app.put('/api/creator/splits', requireCreatorSession, (req, res) => {
    const session = (req as express.Request & { flowSession?: { creator_id: string } }).flowSession!;
    const collaborators = Array.isArray(req.body.collaborators) ? req.body.collaborators : [];
    const split = splitsRepo.upsert({
      creator_id: session.creator_id,
      creator_bps: Number(req.body.creator_bps ?? 8500),
      pool_bps: Number(req.body.pool_bps ?? 1000),
      protocol_bps: Number(req.body.protocol_bps ?? 100),
      collaborators: JSON.stringify(collaborators),
    });
    res.json(split);
  });

  app.put('/api/creator/payout', requireCreatorSession, (req, res) => {
    const session = (req as express.Request & { flowSession?: { creator_id: string } }).flowSession!;
    const payout = payoutDestinationsRepo.upsert({
      creatorId: session.creator_id,
      family: req.body.family as WalletFamily,
      network: String(req.body.network ?? 'polygon'),
      token: String(req.body.token ?? 'USDT'),
      address: String(req.body.address ?? ''),
    });
    res.json(payout);
  });

  app.put('/api/creator/overlay', requireCreatorSession, (req, res) => {
    const session = (req as express.Request & { flowSession?: { creator_id: string } }).flowSession!;
    const overlay = creatorOverlaySettingsRepo.upsert(session.creator_id, {
      rumble_handle: typeof req.body.rumble_handle === 'string' ? req.body.rumble_handle : undefined,
      theme: typeof req.body.theme === 'string' ? req.body.theme : undefined,
      position: typeof req.body.position === 'string' ? req.body.position : undefined,
      show_tip_alerts: req.body.show_tip_alerts === false ? 0 : 1,
      show_pool_bar: req.body.show_pool_bar === false ? 0 : 1,
      show_leaderboard: req.body.show_leaderboard === false ? 0 : 1,
      accent_color: typeof req.body.accent_color === 'string' ? req.body.accent_color : undefined,
    });
    res.json(overlay);
  });

  app.get('/api/overlay/:handle/state', (_req, res) => {
    res.json(buildOverlayState(_req.params.handle));
  });

  app.get('/api/rounds/:id/report', (req, res) => {
    const round = roundsRepo.findById(req.params.id);
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }
    res.json({
      round,
      allocations: roundAllocationsRepo.listByRound(req.params.id),
      attestation: reportAttestationsRepo.findLatestByRound(req.params.id),
      plan: round.plan_json ? JSON.parse(round.plan_json) : null,
    });
  });

  app.post('/api/agent/skill/:action', requireX402, async (req, res) => {
    const action = req.params.action;
    const input = (req.body ?? {}) as Record<string, unknown>;

    switch (action) {
      case 'handle_watch_event':
        await autoTipAgent.handleWatchEvent(input as never);
        res.json({ ok: true });
        return;
      case 'handle_milestone':
        await eventTriggerAgent.handleMilestone(input as never);
        res.json({ ok: true });
        return;
      case 'handle_super_chat':
        await eventTriggerAgent.handleSuperChat(input as never);
        res.json({ ok: true });
        return;
      case 'handle_native_tip':
        await eventTriggerAgent.handleRumbleTip(input as never);
        res.json({ ok: true });
        return;
      case 'configure_auto_tip':
        res.json(autoTipAgent.registerAutoTipRule({
          viewerId: String(input.viewer_id),
          creatorId: typeof input.creator_id === 'string' ? input.creator_id : undefined,
          budgetPerDayUsdt: BigInt(String(input.budget_per_day ?? input.budget_per_day_base ?? '0')),
          tipOnHalfWatch: BigInt(String(input.tip_on_half_watch ?? '100000')),
          tipOnComplete: BigInt(String(input.tip_on_complete ?? '250000')),
          token: (input.token as never) ?? 'USDT',
          chain: String(input.chain ?? 'polygon'),
          enabled: input.enabled !== false,
        }));
        return;
      case 'configure_split':
        res.json(eventTriggerAgent.configureSplit(String(input.creator_id), {
          creatorId: String(input.creator_id),
          creatorBps: Number(input.creator_bps ?? 8500),
          poolBps: Number(input.pool_bps ?? 1000),
          protocolBps: Number(input.protocol_bps ?? 100),
          collaborators: Array.isArray(input.collaborators) ? input.collaborators as never : [],
        }));
        return;
      case 'get_pool_status':
        res.json(await getPoolSnapshot());
        return;
      case 'get_leaderboard':
        res.json(getRoundLeaderboardSnapshot());
        return;
      default:
        res.status(404).json({ error: 'Unknown skill action' });
    }
  });

  app.get('/api/round/current', (_req, res) => {
    const round = getCurrentRoundSnapshot();
    res.json(round ?? { error: 'No active round' });
  });

  app.get('/api/round/leaderboard', (_req, res) => {
    res.json(getRoundLeaderboardSnapshot());
  });

  app.get('/api/pool', async (_req, res) => {
    const report = await getPoolSnapshot();
    res.json(report);
  });

  app.get('/api/sybil/flags', (_req, res) => {
    res.json(getCurrentRoundSybilFlags());
  });

  app.get('/api/rounds', (_req, res) => {
    res.json(getRecentRoundSnapshots(20));
  });

  app.get('/api/rumble/events', (_req, res) => {
    res.json({ events: getRecentRumbleEvents(50) });
  });

  app.get('/api/rumble/auto-tips', (_req, res) => {
    res.json({
      summary: getRumbleSummary(),
      stats: getRumbleAutoTipStats(7),
    });
  });

  app.get('/api/rumble/milestones', (_req, res) => {
    res.json({ milestones: getRecentMilestoneBonuses(20) });
  });

  app.get('/dashboard', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHtml);
  });

  app.get('/creator', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(creatorHtml);
  });

  app.get('/overlay', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(overlayHtml);
  });

  app.get('/overlay/:handle', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(overlayHtml);
  });

  app.get('/present', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(presentHtml);
  });

  app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(landingHtml);
  });

  return app;
}

export function startDashboard(port: number): void {
  const app = createDashboardApp();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (!url.pathname.startsWith('/ws/overlay/')) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: any) => {
      const handle = decodeURIComponent(url.pathname.replace('/ws/overlay/', ''));
      const unsubscribe = overlayHub.subscribe(event => {
        if (event.creatorHandle && event.creatorHandle.toLowerCase() !== handle.toLowerCase()) {
          return;
        }
        ws.send(JSON.stringify({ type: 'overlay_event', payload: event }));
      });

      ws.on('close', unsubscribe);
      ws.send(JSON.stringify({ type: 'overlay_state', payload: buildOverlayState(handle) }));
    });
  });

  server.listen(port, () => {
    logger.info({ port }, 'Dashboard started');
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDashboard(config.DASHBOARD_PORT);
}
