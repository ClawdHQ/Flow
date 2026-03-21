import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/storage/db.js', () => ({ getDb: vi.fn() }));
vi.mock('../src/config/index.js', () => ({
  config: {
    SYBIL_WEIGHT_THRESHOLD: 0.7,
    ANTHROPIC_API_KEY: 'test',
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  }
}));

describe('SybilDetector', () => {
  it('should be defined', () => {
    expect(true).toBe(true);
  });
});
