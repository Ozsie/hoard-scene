// The public-surface completeness test: every source module is
// re-exported from src/index.ts, so nothing can quietly fall outside the
// public surface — consuming the package through any other path is a
// bug.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = fileURLToPath(new URL('.', import.meta.url));

const indexReExports = (): string[] =>
  [
    ...readFileSync(join(SRC_ROOT, 'index.ts'), 'utf8').matchAll(
      /export \* from '\.\/([^']+)';/g,
    ),
  ].map((m) => m[1].replace(/\.ts$/, ''));

const collectSourceModules = (dir: string, prefix: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSourceModules(path, `${prefix}${entry.name}/`));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'index.ts'
    ) {
      found.push(`${prefix}${entry.name.replace(/\.ts$/, '')}`);
    }
  }
  return found;
};

describe('package public surface', () => {
  it('re-exports every source module from src/index.ts', () => {
    const surface = indexReExports();
    const missing = collectSourceModules(SRC_ROOT, '').filter(
      (m) => !surface.includes(m),
    );
    expect(
      missing,
      `modules missing from src/index.ts: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('re-exports no module twice', () => {
    const surface = indexReExports();
    expect(new Set(surface).size).toBe(surface.length);
  });

  it('re-exports only existing modules', () => {
    for (const module of indexReExports()) {
      expect(
        readdirSync(SRC_ROOT).includes(`${module}.ts`),
        `${module}.ts does not exist`,
      ).toBe(true);
    }
  });
});
