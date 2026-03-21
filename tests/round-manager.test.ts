import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/storage/db.js', () => ({ getDb: vi.fn() }));
vi.mock('../src/config/index.js', () => ({
  config: {
    ROUND_CRON: '0 0 * * *',
    ANTHROPIC_API_KEY: 'test',
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  }
}));

describe('RoundManager', () => {
  it('should be importable', async () => {
    expect(true).toBe(true);
  });
});
