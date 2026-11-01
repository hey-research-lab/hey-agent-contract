import { describe, expect, it } from 'vitest';
import type { ZodEnum, ZodObject, ZodRawShape, ZodType } from 'zod';

import {
  AGENT_CLAIM_STATUSES,
  AGENT_COMPARE_COMPLETENESS,
  AGENT_CONTENT_ORIGINS,
  AGENT_DISCLOSURE_CODES,
  AGENT_LATEST_CHANGE_REASONS,
  AGENT_LINEAGE_STEPS,
  AGENT_NEXT_REFRESH_REASONS,
  AGENT_PRECISIONS,
  AGENT_RECORDED_PROJECT_ROLES,
  AGENT_RESPONSE_STATUSES,
  AGENT_SOURCE_TYPES,
  AGENT_SUBJECT_KINDS,
  AGENT_TOKEN_VERIFICATION_STATUSES,
  AGENT_VALUATION_KINDS,
  AGENT_VERIFY_VERDICTS,
  AGENT_WHAT_CHANGED_SCOPES,
  agentClaimSchema,
  agentClaimStatusSchema,
  agentDisclosureSchema,
  agentFreshnessSchema,
  agentPrecisionSchema,
  agentSourceTypeSchema,
  agentTextSchema,
  type CoverageStateCode,
  AGENT_COVERAGE_STATES,
} from '../src/index';
import { variantOf } from './helpers';

/** Walks into a schema through objects, optionals, nullables and arrays. */
type Def = { type: string; innerType?: ZodType; element?: ZodType };
const defOf = (node: ZodType): Def => node.def as unknown as Def;

/** Steps through optionals and nullables (and, with `arrays`, arrays) to the schema inside. */
function unwrap(schema: ZodType, arrays: boolean): ZodType {
  let node = schema;
  for (;;) {
    const def = defOf(node);
    if ((def.type === 'optional' || def.type === 'nullable') && def.innerType) node = def.innerType;
    else if (arrays && def.type === 'array' && def.element) node = def.element;
    else return node;
  }
}
function at(schema: ZodType, ...path: string[]): ZodType {
  let node = schema;
  for (const key of path) {
    node = (unwrap(node, true) as ZodObject<ZodRawShape>).shape[key] as ZodType;
  }
  return node;
}
const options = (schema: ZodType): readonly string[] =>
  (unwrap(schema, false) as ZodEnum<Record<string, string>>).options;

describe('the vocabulary arrays equal the schema’s own enums', () => {
  it('envelope', () => {
    const envelope = variantOf('research_project');
    expect(options(at(envelope, 'status'))).toEqual(AGENT_RESPONSE_STATUSES);
    expect(options(at(envelope, 'subject', 'kind'))).toEqual(AGENT_SUBJECT_KINDS);
    expect(agentClaimStatusSchema.options).toEqual(AGENT_CLAIM_STATUSES);
    expect(agentPrecisionSchema.options).toEqual(AGENT_PRECISIONS);
    expect(agentSourceTypeSchema.options).toEqual(AGENT_SOURCE_TYPES);
    expect(options(at(agentTextSchema, 'contentOrigin'))).toEqual(AGENT_CONTENT_ORIGINS);
    expect(options(at(agentFreshnessSchema, 'nextExpectedRefreshReason'))).toEqual(
      AGENT_NEXT_REFRESH_REASONS,
    );
    expect(options(at(agentDisclosureSchema, 'code'))).toEqual(AGENT_DISCLOSURE_CODES);
    expect(options(at(agentClaimSchema, 'status'))).toEqual(AGENT_CLAIM_STATUSES);
  });

  it('capability data', () => {
    expect(
      options(at(variantOf('research_project'), 'data', 'latestMeaningfulChangeReason')),
    ).toEqual(AGENT_LATEST_CHANGE_REASONS);
    expect(
      options(at(variantOf('research_project'), 'data', 'marketContext', 'valuation', 'kind')),
    ).toEqual(AGENT_VALUATION_KINDS);
    expect(options(at(variantOf('what_changed'), 'data', 'scope'))).toEqual(
      AGENT_WHAT_CHANGED_SCOPES,
    );
    expect(options(at(variantOf('builder_status'), 'data', 'lineage', 'step'))).toEqual(
      AGENT_LINEAGE_STEPS,
    );
    expect(options(at(variantOf('verify_project'), 'data', 'verdict'))).toEqual(
      AGENT_VERIFY_VERDICTS,
    );
    expect(options(at(variantOf('verify_project'), 'data', 'tokenVerification', 'status'))).toEqual(
      AGENT_TOKEN_VERIFICATION_STATUSES,
    );
    expect(options(at(variantOf('verify_project'), 'data', 'recordedProject', 'role'))).toEqual(
      AGENT_RECORDED_PROJECT_ROLES,
    );
    expect(options(at(variantOf('compare_builders'), 'data', 'completeness'))).toEqual(
      AGENT_COMPARE_COMPLETENESS,
    );
  });

  it('coverage states match the contract’s CoverageStateCode type', () => {
    const all: readonly CoverageStateCode[] = AGENT_COVERAGE_STATES;
    type Missing = Exclude<CoverageStateCode, (typeof AGENT_COVERAGE_STATES)[number]>;
    const exhaustive: [Missing] extends [never] ? true : false = true;
    expect(exhaustive).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });
});
