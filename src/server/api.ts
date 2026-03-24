import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
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
} from '../dashboard/data.js';
import { rumbleWebhookRouter } from '../rumble/webhook.js';
import { autoTipAgent } from '../agent/auto-tip.js';
import { eventTriggerAgent } from '../agent/event-trigger.js';
import { overlayHub } from '../realtime/overlay-hub.js';
import { requireX402 } from '../utils/x402.js';
import { RoundsRepository } from '../storage/repositories/rounds.js';
import { RoundAllocationsRepository } from '../storage/repositories/round-allocations.js';
import { ReportAttestationsRepository } from '../storage/repositories/report-attestations.js';
import { CreatorsRepository } from '../storage/repositories/creators.js';
import { RumbleCreatorLinksRepository } from '../storage/repositories/rumble-creator-links.js';
import { CreatorOverlaySettingsRepository } from '../storage/repositories/creator-overlay-settings.js';

const roundsRepo = new RoundsRepository();
const roundAllocationsRepo = new RoundAllocationsRepository();
const reportAttestationsRepo = new ReportAttestationsRepository();
const creatorsRepo = new CreatorsRepository();
const rumbleLinksRepo = new RumbleCreatorLinksRepository();
const creatorOverlaySettingsRepo = new CreatorOverlaySettingsRepository();

function buildOverlayState(handle: string) {
  const link = rumbleLinksRepo.findByHandle(handle);
  const creator = link?.creator_id ? creatorsRepo.findById(link.creator_id) : creatorsRepo.findByUsername(handle);
  const currentRound = getCurrentRoundSnapshot();
  const leaderboard = getRoundLeaderboardSnapshot();
  const creatorEntry = creator ? leaderboard.find(entry => entry.creator === creator.username) : null;
  const overlay = creator ? creatorOverlaySettingsRepo.findByCreatorId(creator.id) : null;
  return { handle, creator, overlay, round: currentRound, leaderboard: leaderboard.slice(0, 5), creatorEntry };
}

export function createAgentApp(): express.Express {
  const app = express();

  // CORS for Next.js frontend
  app.use(cors({
    origin: [`http://localhost:${process.env['DASHBOARD_PORT'] ?? 3000}`, 'http://localhost:3000'],
    credentials: true,
  }));

  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));

  // Rumble webhook
  app.use('/rumble', rumbleWebhookRouter);

  // Agent skill endpoints
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

  // Data endpoints (used by Next.js proxy)
  app.get('/api/round/current', (_req, res) => {
    const round = getCurrentRoundSnapshot();
    res.json(round ?? { error: 'No active round' });
  });

  app.get('/api/round/leaderboard', (_req, res) => {
    res.json(getRoundLeaderboardSnapshot());
  });

  app.get('/api/pool', async (_req, res) => {
    res.json(await getPoolSnapshot());
  });

  app.get('/api/sybil/flags', (_req, res) => {
    res.json(getCurrentRoundSybilFlags());
  });

  app.get('/api/rounds', (_req, res) => {
    res.json(getRecentRoundSnapshots(20));
  });

  app.get('/api/rounds/:id/report', (req, res) => {
    const round = roundsRepo.findById(req.params.id);
    if (!round) { res.status(404).json({ error: 'Round not found' }); return; }
    res.json({
      round,
      allocations: roundAllocationsRepo.listByRound(req.params.id),
      attestation: reportAttestationsRepo.findLatestByRound(req.params.id),
      plan: round.plan_json ? JSON.parse(round.plan_json) : null,
    });
  });

  app.get('/api/rumble/events', (_req, res) => {
    res.json({ events: getRecentRumbleEvents(50) });
  });

  app.get('/api/rumble/auto-tips', (_req, res) => {
    res.json({ summary: getRumbleSummary(), stats: getRumbleAutoTipStats(7) });
  });

  app.get('/api/rumble/milestones', (_req, res) => {
    res.json({ milestones: getRecentMilestoneBonuses(20) });
  });

  app.get('/api/overlay/:handle/state', (req, res) => {
    res.json(buildOverlayState(req.params.handle));
  });

  return app;
}

export function startAgentApi(port: number): void {
  const app = createAgentApp();
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
        if (event.creatorHandle && event.creatorHandle.toLowerCase() !== handle.toLowerCase()) return;
        ws.send(JSON.stringify({ type: 'overlay_event', payload: event }));
      });
      ws.on('close', unsubscribe);
      ws.send(JSON.stringify({ type: 'overlay_state', payload: buildOverlayState(handle) }));
    });
  });

  server.listen(port, () => {
    logger.info({ port }, 'Agent API server started');
  });
}
