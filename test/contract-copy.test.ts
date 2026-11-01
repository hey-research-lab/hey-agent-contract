import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PRODUCTION_CONTRACT_COMMIT } from '../src/index';
import { readJson, readText, ROOT } from './helpers';

/**
 * src/contract/ is a byte-for-byte copy of production's pure contract modules. These tests catch
 * a hand edit; `pnpm parity:source` (with HEY_CONTRACT_SOURCE) compares with the source itself.
 */
const parity = readJson<{
  commit: string;
  files: Record<string, string>;
  excerpts: { from: string; sha256: string }[];
  vendored: Record<string, { from: string; to: string; sha256: string }>;
}>('PARITY.json');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('the copied production contract', () => {
  it('records the commit it was copied from, and the package says the same', () => {
    expect(parity.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(PRODUCTION_CONTRACT_COMMIT).toBe(parity.commit);
  });

  it('holds exactly the recorded files, plus the excerpts', () => {
    const files = readdirSync(join(ROOT, 'src', 'contract')).sort();
    expect(files).toEqual([...Object.keys(parity.files), 'excerpts.ts'].sort());
  });

  for (const [file, hash] of Object.entries(parity.files)) {
    it(`${file} is unedited`, () => {
      expect(sha256(readText('src', 'contract', file))).toBe(hash);
    });
  }

  it('keeps every verbatim excerpt unedited', () => {
    const text = readText('src', 'contract', 'excerpts.ts');
    const blocks = [
      ...text.matchAll(/\/\/ <verbatim from="([^"]+)">\n([\s\S]*?)\n\/\/ <\/verbatim>/g),
    ].map((m) => ({
      from: m[1],
      sha256: sha256(m[2] ?? ''),
    }));
    expect(blocks).toEqual(parity.excerpts);
  });

  it('copies no composer, adapter, database or provider code', () => {
    const vendored = Object.keys(parity.vendored);
    const all = [
      ...readdirSync(join(ROOT, 'src', 'contract')).map((file) =>
        readText('src', 'contract', file),
      ),
      ...Object.values(parity.vendored).map((entry) => readText(entry.to)),
    ]
      .join('\n')
      // The modules production's contract imports from HEY's other packages are vendored, byte for byte.
      .replace(/from '(@hey\/[^']+)'/g, (match, specifier: string) =>
        vendored.includes(specifier) ? "from '<vendored>'" : match,
      );
    expect(all).not.toMatch(
      /from '\.\/compose|from '\.\/adapters|from '@hey\/|@hey-research-lab\/sdk|fetch\(|process\.env/,
    );
  });
});

describe('the vendored modules production’s contract imports', () => {
  const tsconfig = readJson<{ compilerOptions: { paths: Record<string, string[]> } }>(
    'tsconfig.json',
  );
  const vitestConfig = readText('vitest.config.ts');

  for (const [specifier, entry] of Object.entries(parity.vendored)) {
    it(`${specifier} is unedited, and mapped where the copy imports it`, () => {
      expect(entry.to.startsWith('src/vendor/')).toBe(true);
      expect(sha256(readText(entry.to))).toBe(entry.sha256);
      expect(tsconfig.compilerOptions.paths[specifier]).toEqual([`./${entry.to}`]);
      expect(vitestConfig).toContain(`'${specifier}': vendored('./${entry.to}')`);
    });
  }

  it('imports nothing but zod and one another', () => {
    for (const entry of Object.values(parity.vendored)) {
      const imports = [...readText(entry.to).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const specifier of imports)
        expect(specifier === 'zod' || specifier! in parity.vendored, entry.to).toBe(true);
    }
  });
});
