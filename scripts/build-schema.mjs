#!/usr/bin/env node
// Writes schema/*.json from the built package (run by `pnpm build`, after tsup). The files are
// committed; CI fails when they differ from a fresh build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as contract from '../dist/index.js';
import { buildJsonSchemas, serialise, STRICT_FILE, TOLERANT_FILE } from './json-schema.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
mkdirSync(OUT, { recursive: true });
const { strict, tolerant } = buildJsonSchemas(contract);
writeFileSync(join(OUT, STRICT_FILE), serialise(strict));
writeFileSync(join(OUT, TOLERANT_FILE), serialise(tolerant));
console.log(`schema: wrote ${STRICT_FILE} and ${TOLERANT_FILE}`);
