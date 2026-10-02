#!/usr/bin/env node
// Holds src/contract/ to HEY's production agent contract.
//
//   node scripts/check-source-parity.mjs
//       Offline: every copied file still has the SHA-256 recorded in PARITY.json (nobody edited a
//       copy by hand). The test suite runs the same check.
//
//   HEY_CONTRACT_SOURCE=<dir> node scripts/check-source-parity.mjs
//       Against a checkout of the contract's source directory (`packages/agent-provider-core/src`
//       in hey-research-open, or the production tree it mirrors): each copied file is byte-equal
//       to the source file, and each <verbatim> block in excerpts.ts occurs in its source file.
//       Exit 1 on any drift, listing the files.
//
//   HEY_CONTRACT_SOURCE=<dir> HEY_CONTRACT_COMMIT=<sha> node scripts/check-source-parity.mjs --update
//       Copies the files again, refreshes the excerpt blocks' hashes and records the commit.
//       Review the diff: an additive change ships as a minor release; a change of meaning is v2.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = join(ROOT, 'src', 'contract');
const PARITY_PATH = join(ROOT, 'PARITY.json');
const parity = JSON.parse(readFileSync(PARITY_PATH, 'utf8'));

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const read = (path) => readFileSync(path, 'utf8');

/** The <verbatim from="…"> blocks of excerpts.ts, in order. */
function excerptBlocks(text) {
  const blocks = [];
  const re = /\/\/ <verbatim from="([^"]+)">\n([\s\S]*?)\n\/\/ <\/verbatim>/g;
  for (const match of text.matchAll(re)) blocks.push({ from: match[1], text: match[2] });
  return blocks;
}

const problems = [];
const source = process.env.HEY_CONTRACT_SOURCE ? resolve(process.env.HEY_CONTRACT_SOURCE) : null;
const update = process.argv.includes('--update');

if (update && (!source || !process.env.HEY_CONTRACT_COMMIT)) {
  console.error('--update needs HEY_CONTRACT_SOURCE and HEY_CONTRACT_COMMIT.');
  process.exit(2);
}

const sourceFile = (name) => {
  const path = resolve(source, name);
  if (!path.startsWith(`${source}/`))
    throw new Error(`refusing a path outside the source: ${name}`);
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) return null;
  return path;
};

for (const name of Object.keys(parity.files)) {
  const local = join(CONTRACT, name);
  if (update) {
    const from = sourceFile(name);
    if (!from) problems.push(`${name}: missing in the source`);
    else copyFileSync(from, local);
  }
  const text = read(local);
  if (update) parity.files[name] = sha256(text);
  else if (sha256(text) !== parity.files[name])
    problems.push(`${name}: edited (hash differs from PARITY.json)`);
  if (source && !update) {
    const from = sourceFile(name);
    if (!from) problems.push(`${name}: missing in the source`);
    else if (read(from) !== text) problems.push(`${name}: differs from the source`);
  }
}

const blocks = excerptBlocks(read(join(CONTRACT, 'excerpts.ts')));
if (blocks.length !== parity.excerpts.length)
  problems.push('excerpts.ts: block count differs from PARITY.json');
blocks.forEach((block, i) => {
  const recorded = parity.excerpts[i];
  if (!recorded || recorded.from !== block.from)
    problems.push(`excerpts.ts block ${i + 1}: source differs`);
  if (update && recorded) recorded.sha256 = sha256(block.text);
  else if (recorded && sha256(block.text) !== recorded.sha256)
    problems.push(`excerpts.ts block ${i + 1}: edited`);
  if (source) {
    const from = sourceFile(block.from);
    if (!from || !read(from).includes(block.text))
      problems.push(`excerpts.ts block ${i + 1}: not found in ${block.from}`);
  }
});

if (update && problems.length === 0) {
  parity.commit = process.env.HEY_CONTRACT_COMMIT;
  parity.extractedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(PARITY_PATH, `${JSON.stringify(parity, null, 2)}\n`);
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(
  `contract parity ok: ${Object.keys(parity.files).length} files, ${blocks.length} excerpts, commit ${parity.commit}${source ? ' (checked against the source)' : ''}`,
);
