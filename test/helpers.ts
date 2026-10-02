import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  agentIntelligenceResponseSchema,
  type AgentCapability,
  type AgentIntelligenceResponse,
} from '../src/index';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = join(ROOT, 'fixtures');

export const readText = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');
export const readJson = <T = unknown>(...parts: string[]): T => JSON.parse(readText(...parts)) as T;

export type LiveIndexEntry = { name: string; url: string; httpStatus: number; recordedAt: string };
export const liveIndex = (): LiveIndexEntry[] =>
  readJson<LiveIndexEntry[]>('fixtures', 'live', 'index.json');
export const live = <T = AgentIntelligenceResponse>(name: string): T =>
  readJson<T>('fixtures', 'live', `${name}.json`);
export const liveFiles = (): string[] =>
  readdirSync(join(FIXTURES, 'live')).filter(
    (file) => file.endsWith('.json') && file !== 'index.json',
  );

export type EdgeExpect = {
  strict: 'valid' | string;
  tolerant?: 'valid' | string;
  path?: string;
  ignoredFields?: string[];
  invariants?: string[];
  parseText?: boolean;
};
export type EdgeIndexEntry = { file: string; description: string; expect: EdgeExpect };
export const edgeIndex = (): EdgeIndexEntry[] =>
  readJson<EdgeIndexEntry[]>('fixtures', 'edge', 'index.json');

/** One capability's object schema inside the discriminated union. */
export function variantOf(capability: AgentCapability) {
  const schema = agentIntelligenceResponseSchema.optionsMap.get(capability);
  if (!schema) throw new Error(`no variant for ${capability}`);
  return schema;
}

/** A deep copy, for tests that change a fixture. */
export const clone = <T>(value: T): T => structuredClone(value);
