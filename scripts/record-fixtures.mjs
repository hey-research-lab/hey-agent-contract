#!/usr/bin/env node
// Records the live example responses in fixtures/live/ from HEY's public agent API.
//
// Read-only GETs against https://heyresearch.xyz only, paced at no more than one request a
// second. Never run in CI: it needs HEY_LIVE=1. Usage:
//
//   HEY_LIVE=1 node scripts/record-fixtures.mjs [name ...]
//
// With names, only those fixtures are recorded again (the index keeps the others).
// The responses are written unchanged (pretty-printed JSON) with an index of what was asked,
// the HTTP status and when. Review the diff before committing a refresh.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.HEY_LIVE !== '1') {
  console.error('record-fixtures: set HEY_LIVE=1 to make live requests to heyresearch.xyz.');
  process.exit(2);
}

const BASE = 'https://heyresearch.xyz';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'live');
const PACE_MS = 1200;
const MAX_BYTES = 256 * 1024;
const USER_AGENT =
  'hey-agent-contract-fixtures/0.1.0 (+https://github.com/hey-research-lab/hey-agent-contract)';

// HEY's own token, a public fact (https://heyresearch.xyz/openapi.json, info.x-hey.token).
const HEY_TOKEN = '0xb33eb16782776b4d738c0fd643577cb0284db610';

/** name → path (fixed host; nothing here comes from user input). */
const REQUESTS = [
  ['research_project', '/api/agent/research_project?project=agentos'],
  ['what_changed.project', '/api/agent/what_changed?project=agentos&days=30&limit=10'],
  ['what_changed.chain', '/api/agent/what_changed?days=1&limit=5'],
  ['builder_status', '/api/agent/builder_status?project=agentos'],
  ['verify_project.hey_own_token', `/api/agent/verify_project?address=${HEY_TOKEN}`],
  ['compare_builders', '/api/agent/compare_builders?projects=agentos,hey-research-lab'],
  ['unknowns', '/api/agent/unknowns?project=agentos'],
  ['refusal.unsupported_chain', '/api/agent/research_project?project=agentos&chainId=1'],
  ['refusal.not_found', '/api/agent/research_project?project=zz-no-such-project-0'],
  ['refusal.unknown_capability', '/api/agent/price_prediction?project=agentos'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const only = new Set(process.argv.slice(2));
const unknown = [...only].filter((name) => !REQUESTS.some(([known]) => known === name));
if (unknown.length) {
  console.error(`record-fixtures: no such fixture: ${unknown.join(', ')}`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const indexPath = join(OUT, 'index.json');
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
const index = [];
const selected = REQUESTS.filter(([name]) => only.size === 0 || only.has(name));
for (const [i, [name, path]] of selected.entries()) {
  if (i > 0) await sleep(PACE_MS);
  const url = `${BASE}${path}`;
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error(`${name}: response larger than ${MAX_BYTES} bytes`);
  const body = JSON.parse(text);
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`);
  index.push({ name, url, httpStatus: response.status, recordedAt: new Date().toISOString() });
  console.log(`${response.status} ${name}`);
}
const merged = REQUESTS.map(
  ([name]) => index.find((e) => e.name === name) ?? previous.find((e) => e.name === name),
).filter(Boolean);
writeFileSync(indexPath, `${JSON.stringify(merged, null, 2)}\n`);
