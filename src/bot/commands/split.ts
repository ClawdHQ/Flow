import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { EventTriggerAgent } from '../../agent/event-trigger.js';
import { CreatorsRepository } from '../../storage/repositories/creators.js';
import { SplitsRepository } from '../../storage/repositories/splits.js';
import { normalizeWalletAddress, resolveSupportedChain } from '../../wallet/addresses.js';

const creatorsRepo = new CreatorsRepository();
const splitsRepo = new SplitsRepository();
const eventTriggerAgent = new EventTriggerAgent();

function toBps(percentage: string): number {
  const parsed = Number.parseFloat(percentage);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('Percentages must be between 0 and 100.');
  }
  return Math.round(parsed * 100);
}

export async function handleSplit(ctx: Context): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  const creator = creatorsRepo.findByTelegramId(telegramId);

  if (!creator) {
    await ctx.reply('❌ You are not registered. Use /register first.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    const split = splitsRepo.findByCreatorId(creator.id);
    const collaborators = split?.collaborators ? JSON.parse(split.collaborators) as Array<{ address: string; bps: number }> : [];
    const collaboratorLines = collaborators.length > 0
      ? collaborators.map(collaborator => `• \`${collaborator.address}\` — ${(collaborator.bps / 100).toFixed(2)}%`).join('\n')
      : '• None';
    await ctx.reply(
      `📊 **Current Split**\n\n` +
      `Creator: ${((split?.creator_bps ?? config.SPLIT_CREATOR_BPS) / 100).toFixed(2)}%\n` +
      `Pool: ${((split?.pool_bps ?? config.SPLIT_POOL_BPS) / 100).toFixed(2)}%\n` +
      `Protocol: ${((split?.protocol_bps ?? config.PROTOCOL_FEE_BPS) / 100).toFixed(2)}%\n` +
      `Collaborators:\n${collaboratorLines}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    const creatorBps = toBps(parts[1]!);
    const collaborators: Array<{ address: string; chain: string; bps: number }> = [];

    for (let i = 2; i < parts.length; i += 2) {
      const rawAddress = parts[i];
      const rawPct = parts[i + 1];
      if (!rawAddress || !rawPct) {
        throw new Error('Collaborators must be passed as address/percentage pairs.');
      }
      collaborators.push({
        address: normalizeWalletAddress(rawAddress, resolveSupportedChain(creator.preferred_chain)),
        chain: creator.preferred_chain,
        bps: toBps(rawPct),
      });
    }

    const collaboratorBps = collaborators.reduce((sum, collaborator) => sum + collaborator.bps, 0);
    const remaining = 10_000 - creatorBps - collaboratorBps - config.PROTOCOL_FEE_BPS;
    if (remaining < 0) {
      throw new Error('Creator + collaborator percentages leave no room for pool and protocol.');
    }

    eventTriggerAgent.configureSplit(creator.id, {
      creatorId: creator.id,
      creatorBps,
      poolBps: remaining,
      protocolBps: config.PROTOCOL_FEE_BPS,
      collaborators,
    });

    await ctx.reply(
      `✅ Split updated.\n\n` +
      `Creator: ${(creatorBps / 100).toFixed(2)}%\n` +
      `Pool: ${(remaining / 100).toFixed(2)}%\n` +
      `Protocol: ${(config.PROTOCOL_FEE_BPS / 100).toFixed(2)}%\n` +
      `Collaborators: ${collaborators.length}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update split.';
    await ctx.reply(`${message}\n\nUsage: /split [creator_pct] [collaborator_address] [collaborator_pct] ...`);
  }
}
