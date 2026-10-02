import { describe, expect, it } from 'vitest';
import type { ZodObject, ZodRawShape, ZodTypeAny } from 'zod';

import {
  AGENT_CAPABILITIES,
  AGENT_CAPABILITY_INFO,
  AGENT_CLAIM_STATUSES,
  AGENT_CONTENT_ORIGINS,
  AGENT_DATA_FAMILIES,
  AGENT_EVIDENCE_KIND_MEANINGS,
  AGENT_EVIDENCE_KINDS,
  AGENT_FRESHNESS_STATUSES,
  AGENT_FRESHNESS_VERSION,
  AGENT_LIMITS,
  AGENT_NEXT_REFRESH_REASONS,
  AGENT_NOT_PROVIDED,
  AGENT_PRECISIONS,
  AGENT_RESPONSE_STATUSES,
  AGENT_SCHEMA,
  AGENT_SCHEMA_VERSION,
  AGENT_SOURCE_TYPES,
  AGENT_UNKNOWN_CATEGORIES,
  DO_NOT_CONCLUDE,
  FAMILY_SCHEDULES,
  HEY_OWN_TOKEN_DISCLOSURE,
  HEY_OWN_TOKEN_DISCLOSURE_CODE,
  MACHINE_TEXT_VERSION,
  STILL_BUILDING_STATES,
  agentClaimSchema,
  agentFreshnessSchema,
  agentTextSchema,
  agentUnknownSchema,
} from '../src/index';
import { readJson, variantOf } from './helpers';

/**
 * Parity with production's published description of the contract: the agent parts of
 * https://heyresearch.xyz/openapi.json and the catalogue at https://heyresearch.xyz/api/agent,
 * saved in fixtures/parity/. Refresh them with `HEY_LIVE=1 pnpm parity:refresh` (CONTRIBUTING.md).
 * A failure after a refresh means production's contract moved and this package must follow.
 */

type Json = Record<string, unknown> & {
  properties: Record<string, Json>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  maxItems?: number;
  maxLength?: number;
  items?: Json;
};

const openapi = readJson<{
  infoVersion: string;
  paths: Record<string, { get: { parameters: { name: string; schema: { enum?: string[] } }[] } }>;
  components: { schemas: { AgentIntelligenceResponse: Json } };
}>('fixtures', 'parity', 'openapi.agent.json');
const catalogue = readJson<
  Record<string, unknown> & {
    capabilities: {
      id: string;
      question: string;
      returns: string;
      params: unknown[];
      canonicalReads: string[];
      never: string;
      a2a: { skill: string };
    }[];
    boundaries: { notProvided: string[]; notAdvice: boolean; marketIsContextOnly: boolean };
    response: {
      machineText: { version: string; contentOrigin: string[] };
      evidenceKinds: { kind: string; meaning: string }[];
      stillBuildingStates: { states: string[] };
      disclosures: { code: string; statement: string }[];
      limits: Record<string, number>;
      unknownCategories: { category: string; doNotConclude: string }[];
      freshness: {
        version: string;
        statuses: string[];
        families: { family: string; job: string; staleAfterHours: number; basis: string }[];
      };
    };
  }
>('fixtures', 'parity', 'agent-catalogue.json');

const response = openapi.components.schemas.AgentIntelligenceResponse;
const shapeOf = (schema: ZodTypeAny): ZodRawShape =>
  (schema as unknown as ZodObject<ZodRawShape>).shape;
const keys = (schema: ZodTypeAny): string[] => Object.keys(shapeOf(schema)).sort();
const requiredKeys = (schema: ZodTypeAny): string[] =>
  Object.entries(shapeOf(schema))
    .filter(([, field]) => !field.isOptional())
    .map(([key]) => key)
    .sort();
const sorted = (list: readonly unknown[] | undefined): unknown[] =>
  [...(list ?? [])].map(String).sort();

describe('parity with production’s OpenAPI document (AgentIntelligenceResponse)', () => {
  const envelope = variantOf('research_project');

  it('names the same schema and version', () => {
    expect(response.properties.schema!.const).toBe(AGENT_SCHEMA);
    expect(response.properties.schemaVersion!.const).toBe(AGENT_SCHEMA_VERSION);
    expect(openapi.infoVersion).toBe('1');
  });

  it('offers the same six capabilities, in order, on the response and the route', () => {
    expect(response.properties.capability!.enum).toEqual([...AGENT_CAPABILITIES]);
    const param = openapi.paths['/api/agent/{capability}']!.get.parameters.find(
      (p) => p.name === 'capability',
    );
    expect(param?.schema.enum).toEqual([...AGENT_CAPABILITIES]);
  });

  it('has the same envelope fields, and requires the same ones', () => {
    expect(Object.keys(response.properties).sort()).toEqual(keys(envelope));
    expect(sorted(response.required)).toEqual(requiredKeys(envelope));
    expect(response.properties.status!.enum).toEqual([...AGENT_RESPONSE_STATUSES]);
    expect(response.properties.answerStatus!.enum).toEqual([...AGENT_CLAIM_STATUSES]);
  });

  it('describes AgentText the same way', () => {
    const text = response.properties.answer!;
    expect(Object.keys(text.properties).sort()).toEqual(keys(agentTextSchema));
    expect(sorted(text.required)).toEqual(requiredKeys(agentTextSchema));
    expect(text.properties.contentOrigin!.enum).toEqual([...AGENT_CONTENT_ORIGINS]);
    expect(text.properties.text!.maxLength).toBe(620);
  });

  it('describes a claim the same way', () => {
    const claim = response.properties.claims!.items!;
    expect(response.properties.claims!.maxItems).toBe(AGENT_LIMITS.claims);
    expect(Object.keys(claim.properties).sort()).toEqual(keys(agentClaimSchema));
    expect(sorted(claim.required)).toEqual(requiredKeys(agentClaimSchema));
    expect(claim.properties.status!.enum).toEqual([...AGENT_CLAIM_STATUSES]);
    expect(claim.properties.source!.properties.type!.enum).toEqual([...AGENT_SOURCE_TYPES]);
    expect(claim.properties.precision!.enum).toEqual([...AGENT_PRECISIONS, null]);
    expect(claim.properties.freshness!.enum).toEqual([...AGENT_FRESHNESS_STATUSES]);
    expect(claim.properties.evidenceKind!.enum).toEqual([...AGENT_EVIDENCE_KINDS]);
    expect(claim.properties.evidence!.maxItems).toBe(AGENT_LIMITS.evidencePerClaim);
    expect(claim.properties.contextOnly!.const).toBe(true);
  });

  it('describes an unknown the same way', () => {
    const unknown = response.properties.unknowns!.items!;
    expect(response.properties.unknowns!.maxItems).toBe(AGENT_LIMITS.unknowns);
    expect(Object.keys(unknown.properties).sort()).toEqual(keys(agentUnknownSchema));
    expect(sorted(unknown.required)).toEqual(requiredKeys(agentUnknownSchema));
    expect(unknown.properties.category!.enum).toEqual([...AGENT_UNKNOWN_CATEGORIES]);
  });

  it('describes freshness the same way', () => {
    const freshness = response.properties.freshness!.items!;
    expect(response.properties.freshness!.maxItems).toBe(AGENT_LIMITS.freshness);
    expect(Object.keys(freshness.properties).sort()).toEqual(keys(agentFreshnessSchema));
    expect(sorted(freshness.required)).toEqual(requiredKeys(agentFreshnessSchema));
    expect(freshness.properties.family!.enum).toEqual([...AGENT_DATA_FAMILIES]);
    expect(freshness.properties.freshnessStatus!.enum).toEqual([...AGENT_FRESHNESS_STATUSES]);
    expect(freshness.properties.nextExpectedRefreshReason!.enum).toEqual([
      ...AGENT_NEXT_REFRESH_REASONS,
    ]);
  });

  it('bounds evidence and states the boundaries and disclosures the same way', () => {
    expect(response.properties.evidence!.maxItems).toBe(AGENT_LIMITS.evidence);
    const boundaries = response.properties.boundaries!;
    expect(boundaries.properties.notAdvice!.const).toBe(true);
    expect(boundaries.properties.marketIsContextOnly!.const).toBe(true);
    const disclosures = response.properties.disclosures!;
    expect(disclosures.maxItems).toBe(4);
    expect(disclosures.items!.properties.code!.enum).toEqual([HEY_OWN_TOKEN_DISCLOSURE_CODE]);
    expect(String(disclosures.description)).toContain(HEY_OWN_TOKEN_DISCLOSURE);
    for (const state of STILL_BUILDING_STATES)
      expect(String(response.properties.data!.description)).toContain(state);
  });
});

describe('parity with production’s agent catalogue (GET /api/agent)', () => {
  it('names the same schema, version and chain', () => {
    expect(catalogue.schema).toBe(AGENT_SCHEMA);
    expect(catalogue.schemaVersion).toBe(AGENT_SCHEMA_VERSION);
    expect(catalogue.chain).toEqual({ name: 'Robinhood Chain', chainId: 4663 });
  });

  it('describes the six capabilities in the same words', () => {
    expect(catalogue.capabilities.map((c) => c.id)).toEqual([...AGENT_CAPABILITIES]);
    for (const capability of catalogue.capabilities) {
      const info = AGENT_CAPABILITY_INFO[capability.id as (typeof AGENT_CAPABILITIES)[number]];
      expect(capability.question).toBe(info.question);
      expect(capability.returns).toBe(info.returns);
      expect(capability.never).toBe(info.never);
      expect(capability.params).toEqual(info.params);
      expect(capability.canonicalReads).toEqual(info.canonicalReads);
      expect(capability.a2a.skill).toBe(info.a2aSkill);
    }
  });

  it('lists the same boundaries', () => {
    expect(catalogue.boundaries.notProvided).toEqual([...AGENT_NOT_PROVIDED]);
    expect(catalogue.boundaries.notAdvice).toBe(true);
    expect(catalogue.boundaries.marketIsContextOnly).toBe(true);
  });

  it('uses the same machine-text rules, evidence kinds, states, disclosures and limits', () => {
    expect(catalogue.response.machineText.version).toBe(MACHINE_TEXT_VERSION);
    expect(catalogue.response.machineText.contentOrigin).toEqual([...AGENT_CONTENT_ORIGINS]);
    expect(catalogue.response.evidenceKinds).toEqual(
      AGENT_EVIDENCE_KINDS.map((kind) => ({ kind, meaning: AGENT_EVIDENCE_KIND_MEANINGS[kind] })),
    );
    expect(catalogue.response.stillBuildingStates.states).toEqual([...STILL_BUILDING_STATES]);
    expect(catalogue.response.disclosures).toEqual([
      { code: HEY_OWN_TOKEN_DISCLOSURE_CODE, statement: HEY_OWN_TOKEN_DISCLOSURE },
    ]);
    expect(catalogue.response.limits).toEqual({ ...AGENT_LIMITS });
  });

  it('keeps every unknown category’s exact sentence', () => {
    expect(catalogue.response.unknownCategories).toEqual(
      AGENT_UNKNOWN_CATEGORIES.map((category) => ({
        category,
        doNotConclude: DO_NOT_CONCLUDE[category],
      })),
    );
  });

  it('describes freshness with the same statuses, families and schedules', () => {
    const freshness = catalogue.response.freshness;
    expect(freshness.version).toBe(AGENT_FRESHNESS_VERSION);
    expect(freshness.statuses).toEqual([...AGENT_FRESHNESS_STATUSES]);
    expect(freshness.families.map((f) => f.family)).toEqual([...AGENT_DATA_FAMILIES]);
    for (const family of freshness.families) {
      const schedule = FAMILY_SCHEDULES[family.family as (typeof AGENT_DATA_FAMILIES)[number]];
      expect(family.job).toBe(schedule.job);
      expect(family.staleAfterHours).toBe(schedule.staleAfterHours);
      expect(family.basis).toBe(schedule.basis);
    }
  });
});
