import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

describe('copy regressions', () => {
  it('uses the corrected 62.5x example and never the old 4400x claim', () => {
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    const present = fs.readFileSync(path.join(root, 'public', 'present.html'), 'utf8');

    expect(readme).toContain('62.5x');
    expect(present).toContain('62.5x');
    expect(readme).not.toContain('4400x');
    expect(present).not.toContain('4400x');
  });
});
