#!/usr/bin/env node
// Refreshes the parity snapshot in fixtures/parity/ from HEY's live public documents:
//   - https://heyresearch.xyz/openapi.json — only the agent parts are kept (the
//     AgentIntelligenceResponse component and the two /api/agent paths);
//   - https://heyresearch.xyz/api/agent — the agent contract's own catalogue, whole.
//
// Two read-only GETs, one second apart. Never run in CI: it needs HEY_LIVE=1.
//
//   HEY_LIVE=1 node scripts/refresh-parity.mjs
//
// Then run `pnpm test`. A failing parity test after a refresh means production's contract moved:
// copy the new contract files (CONTRIBUTING.md, "Updating from production") before releasing.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.HEY_LIVE !== '1') {
  console.error('refresh-parity: set HEY_LIVE=1 to make live requests to heyresearch.xyz.');
  process.exit(2);
}

const BASE = 'https://heyresearch.xyz';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'parity');
const USER_AGENT =
  'hey-agent-contract-parity/0.2.0 (+https://github.com/hey-research-lab/hey-agent-contract)';
const MAX_BYTES = 2 * 1024 * 1024;

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error(`${path}: larger than ${MAX_BYTES} bytes`);
  return JSON.parse(text);
}

/** The agent parts of the OpenAPI document. */
function agentOpenApi(document, recordedAt) {
  return {
    recordedFrom: `${BASE}/openapi.json`,
    recordedAt,
    openapi: document.openapi,
    infoVersion: document.info?.version,
    paths: {
      '/api/agent': document.paths?.['/api/agent'],
      '/api/agent/{capability}': document.paths?.['/api/agent/{capability}'],
    },
    components: {
      schemas: {
        AgentIntelligenceResponse: document.components?.schemas?.AgentIntelligenceResponse,
      },
    },
  };
}

const recordedAt = new Date().toISOString();
const openapi = await getJson('/openapi.json');
await new Promise((resolve) => setTimeout(resolve, 1000));
const catalogue = await getJson('/api/agent');
writeFileSync(
  join(OUT, 'openapi.agent.json'),
  `${JSON.stringify(agentOpenApi(openapi, recordedAt), null, 2)}\n`,
);
writeFileSync(join(OUT, 'agent-catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`parity snapshot refreshed (${recordedAt})`);
