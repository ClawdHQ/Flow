/**
 * LLMClient — unified Claude client with OpenRouter fallback.
 *
 * Priority order:
 * 1. If ANTHROPIC_API_KEY is set → use Anthropic SDK directly (api.anthropic.com)
 * 2. If OPENROUTER_API_KEY is set → use Anthropic SDK with baseURL pointing to
 *    OpenRouter's Anthropic-compatible endpoint (https://openrouter.ai/api/v1)
 * 3. If neither key is set → client is null (callers must guard against this)
 *
 * The @anthropic-ai/sdk supports a custom baseURL, so the same message-create
 * API works transparently regardless of provider.
 */
import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

function createLLMClient(): Anthropic | null {
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  const openrouterKey = process.env['OPENROUTER_API_KEY'];

  if (anthropicKey && anthropicKey !== 'test') {
    logger.info({ provider: 'anthropic' }, 'LLM client initialized');
    return new Anthropic({ apiKey: anthropicKey });
  }

  if (openrouterKey && openrouterKey !== 'test') {
    const baseURL = process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1';
    logger.info({ provider: 'openrouter', model: process.env['OPENROUTER_MODEL'] }, 'LLM client initialized via OpenRouter');
    return new Anthropic({
      apiKey: openrouterKey,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/ClawdHQ/Flow',
        'X-Title': 'FLOW Quadratic Tipping Agent',
      },
    });
  }

  return null;
}

export const llmClient: Anthropic | null = createLLMClient();

/**
 * Resolve the model name respecting the active provider.
 * OpenRouter uses namespaced model IDs like 'anthropic/claude-sonnet-4'.
 */
export function getModelName(): string {
  if (process.env['ANTHROPIC_API_KEY'] && process.env['ANTHROPIC_API_KEY'] !== 'test') {
    return process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514';
  }
  return process.env['OPENROUTER_MODEL'] ?? 'anthropic/claude-sonnet-4';
}
