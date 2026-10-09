/**
 * The enums that `src/contract/schema.ts` writes inline, as `const` arrays so tooling can list
 * them without reaching into a Zod schema. Each array is held equal to the schema's own enum by
 * `test/vocabulary.test.ts`, and to production's OpenAPI document by `test/parity.test.ts`; they
 * add no value of their own.
 *
 * The arrays the production contract already exports (`AGENT_CAPABILITIES`,
 * `AGENT_UNKNOWN_CATEGORIES`, `AGENT_FRESHNESS_STATUSES`, `AGENT_DATA_FAMILIES`,
 * `AGENT_EVIDENCE_KINDS`, `STILL_BUILDING_STATES`, `AGENT_NOT_PROVIDED`,
 * `VALUATION_NOT_PLAUSIBLE_CODES`) are re-exported from `src/contract/` unchanged.
 */

/** `status`: whether HEY answered, and if not, why. */
export const AGENT_RESPONSE_STATUSES = [
  'ok',
  'not_found',
  'moved',
  'invalid_request',
  'unavailable',
] as const;
export type AgentResponseStatusValue = (typeof AGENT_RESPONSE_STATUSES)[number];

/** `answerStatus`, `claims[].status`, `changes[].status`: FACT (recorded), DERIVED (a rule), UNKNOWN (not held). */
export const AGENT_CLAIM_STATUSES = ['FACT', 'DERIVED', 'UNKNOWN'] as const;

/** `precision` of a date: how exactly the source dates it. */
export const AGENT_PRECISIONS = [
  'EXACT',
  'DATE',
  'WEEK',
  'WINDOW',
  'OBSERVED',
  'SCHEDULED',
] as const;

/** `claims[].source.type`. */
export const AGENT_SOURCE_TYPES = [
  'hey_rule',
  'hey_record',
  'builder_source',
  'chain',
  'market_provider',
  'registry',
  'project_site',
] as const;

/** `AgentText.contentOrigin`: whose words a text field holds. */
export const AGENT_CONTENT_ORIGINS = ['hey', 'derived', 'external_source'] as const;

/** `subject.kind`. */
export const AGENT_SUBJECT_KINDS = ['project', 'contract', 'projects', 'chain'] as const;

/** `verify_project` → `data.verdict`. VERIFIED means the project itself names the contract, never that it is safe. */
export const AGENT_VERIFY_VERDICTS = [
  'VERIFIED',
  'UNVERIFIED',
  'CONTRACT_MISMATCH',
  'UNKNOWN',
] as const;

/** `verify_project` → `data.tokenVerification.status`. */
export const AGENT_TOKEN_VERIFICATION_STATUSES = ['VERIFIED', 'UNVERIFIED', 'MISMATCH'] as const;

/** `verify_project` → `data.recordedProject.role` (nullable). */
export const AGENT_RECORDED_PROJECT_ROLES = ['token', 'declared', 'followup'] as const;

/** `compare_builders` → `data.completeness`. */
export const AGENT_COMPARE_COMPLETENESS = ['complete', 'partial', 'not_compared'] as const;

/** `research_project` → `data.latestMeaningfulChangeReason`: why the latest meaningful change is null. */
export const AGENT_LATEST_CHANGE_REASONS = [
  'not_in_recent_changes',
  'none_recorded',
  'changes_unavailable',
] as const;

/** `freshness[].nextExpectedRefreshReason`: why no next refresh time is given. */
export const AGENT_NEXT_REFRESH_REASONS = ['overdue', 'variable_cadence', 'never_read'] as const;

/** `builder_status` → `data.lineage[].step`: from source to public value. */
export const AGENT_LINEAGE_STEPS = [
  'source',
  'sanitation',
  'selection',
  'derivation',
  'public',
] as const;

/** `research_project` → `data.marketContext.valuation.kind`. FDV is never market cap. */
export const AGENT_VALUATION_KINDS = ['marketCap', 'fdv', 'unspecified'] as const;

/** `disclosures[].code`. */
export const AGENT_DISCLOSURE_CODES = ['hey_own_token'] as const;

/** `what_changed` → `data.scope`. */
export const AGENT_WHAT_CHANGED_SCOPES = ['project', 'chain'] as const;

/**
 * HEY's canonical coverage states, as `unknowns[].coverageState` carries them (the contract's
 * `CoverageStateCode` type). `MEASURED`, `NOT_APPLICABLE` and `WITHHELD` are not gaps. `PARTIAL`
 * (part of it measured → `INSUFFICIENT_EVIDENCE`) and `MAPPING_BLOCKED` (a candidate HEY holds that
 * nothing yet ties to the project → `NOT_VERIFIED`) are production's since 2026-10-09. The schema
 * types `coverageState` as an open machine code: handle a state this list does not know.
 */
export const AGENT_COVERAGE_STATES = [
  'MEASURED',
  'NO_SOURCE',
  'NOT_ENOUGH_YET',
  'STALE',
  'SOURCE_UNAVAILABLE',
  'NOT_APPLICABLE',
  'NOT_RESEARCHED',
  'ERROR',
  'WITHHELD',
  'PARTIAL',
  'MAPPING_BLOCKED',
] as const;

/**
 * `error.code` values production sends in the contract's envelope, as of the recorded commit.
 * The schema types `error.code` as an open machine code, so this list is known values, not a
 * closed enum: tooling must handle a code it does not know.
 *
 * - `invalid_request` — a malformed parameter (HTTP 400);
 * - `unsupported_chain` — a `chainId` other than 4663 (HTTP 400);
 * - `not_found` — no published project with that slug (HTTP 404);
 * - `moved` — the project was renamed; `error.movedTo` names the new slug (HTTP 308);
 * - `unknown_change_type` — `what_changed` asked for a change type HEY does not publish (HTTP 400);
 * - `not_a_token_identity` — the zero or dead address (HTTP 400);
 * - `too_few_projects_found` — `compare_builders` found fewer than two projects (HTTP 404);
 * - `compare_disabled` — `compare_builders` is switched off on this deployment (HTTP 404).
 *
 * An unknown capability is not answered in this envelope: the route answers 404 with HEY's API
 * error envelope (`{ error: "not_found", message, retryable, requestId }`).
 */
export const AGENT_KNOWN_ERROR_CODES = [
  'invalid_request',
  'unsupported_chain',
  'not_found',
  'moved',
  'unknown_change_type',
  'not_a_token_identity',
  'too_few_projects_found',
  'compare_disabled',
] as const;
