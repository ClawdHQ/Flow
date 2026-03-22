import { createHmac, timingSafeEqual } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { RumbleEvent } from './events.js';
import { autoTipAgent } from '../agent/auto-tip.js';
import { eventTriggerAgent } from '../agent/event-trigger.js';
import { RumbleEventsRepository } from '../storage/repositories/rumble-events.js';
import type {
  LivestreamMilestoneEvent,
  RumbleTipEvent,
  SuperChatEvent,
  WatchProgressEvent,
} from './events.js';

const rumbleEventsRepo = new RumbleEventsRepository();

export function verifySignature(body: Buffer, signature: string): boolean {
  if (!config.RUMBLE_WEBHOOK_SECRET) {
    return true;
  }
  const expected = createHmac('sha256', config.RUMBLE_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  const sigHex = signature.replace('sha256=', '').trim();
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}

export async function processRumbleEvent(event: RumbleEvent): Promise<void> {
  rumbleEventsRepo.insert(event);
  try {
    switch (event.event_type) {
      case 'video.watch_progress':
      case 'video.watch_completed':
        await autoTipAgent.handleWatchEvent(event as WatchProgressEvent);
        break;
      case 'livestream.milestone':
        await eventTriggerAgent.handleMilestone(event as LivestreamMilestoneEvent);
        break;
      case 'livestream.super_chat':
        await eventTriggerAgent.handleSuperChat(event as SuperChatEvent);
        break;
      case 'tip.completed':
        await eventTriggerAgent.handleRumbleTip(event as RumbleTipEvent);
        break;
      default:
        break;
    }
    rumbleEventsRepo.markProcessed(event.event_id);
  } catch (err) {
    logger.error({ module: 'rumble', err, event }, 'Webhook handler error');
  }
}

export const rumbleWebhookRouter = Router();

rumbleWebhookRouter.post('/webhook', (req: Request, res: Response) => {
  const signature = String(req.headers['x-rumble-signature'] ?? '');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifySignature(rawBody, signature)) {
    logger.warn({ module: 'rumble', action: 'webhook_sig_failed' }, 'Rejected Rumble webhook with invalid signature');
    res.sendStatus(401);
    return;
  }

  const event = req.body as RumbleEvent;
  res.sendStatus(200);
  logger.info({ module: 'rumble', eventType: event.event_type, eventId: event.event_id }, 'Received Rumble event');
  void processRumbleEvent(event);
});
