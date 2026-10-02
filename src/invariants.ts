import {
  HEY_OWN_TOKEN_DISCLOSURE,
  stillBuildingStateOf,
  type StillBuildingState,
} from './contract/disclosures';
import { isContextChange } from './contract/excerpts';
import type { AgentChange, AgentClaim, AgentIntelligenceResponse } from './contract/schema';
import type { AgentText } from './contract/text';

/**
 * Rules HEY's composers keep that a Zod shape cannot express. A response can be well-formed and
 * still break one of them; tooling that builds or relays answers can hold itself to the same rules.
 * Each rule is what production does at the recorded commit, checked over the recorded live answers.
 */
export type AgentInvariantCode =
  /** A claim tagged UNKNOWN names a source: HEY names none for what it does not hold. */
  | 'unknown_claim_with_source'
  /** A claim tagged UNKNOWN carries 0, false or "" — a stand-in for "not held". */
  | 'unknown_as_zero_or_false'
  /** A claim resting on a market or usage reading is not marked `contextOnly`. */
  | 'market_claim_not_context_only'
  /** A market, market-integrity or usage change counts as building. */
  | 'context_change_counts_as_building'
  /** Text from a source does not say which kind of source (`source`). */
  | 'external_text_without_source'
  /** HEY's own text carries a source, a source URL or an instruction flag. */
  | 'hey_text_with_source_fields'
  /** What an agent must not conclude from a gap is not HEY's own words. */
  | 'do_not_conclude_not_hey'
  /** The `hey_own_token` disclosure does not carry HEY's sentence. */
  | 'disclosure_statement_mismatch'
  /** `stillBuilding` and `stillBuildingState` disagree. */
  | 'still_building_state_conflict'
  /** The receipt citation names another capability. */
  | 'citation_capability_mismatch'
  /** A refused answer (`status` other than `ok`) carries no `error`. */
  | 'refusal_without_error';

export type AgentInvariantViolation = { code: AgentInvariantCode; path: string; message: string };

const CONTEXT_EVIDENCE_KINDS: ReadonlySet<string> = new Set(['market_reading', 'usage_reading']);

/**
 * Whether a claim is context — market or usage — and so never builder evidence: marked
 * `contextOnly`, resting on a market or usage reading, or sourced from a market provider. A FACT
 * tag does not change this: a recorded market figure is still context.
 */
export function isContextOnlyClaim(
  claim: Pick<AgentClaim, 'contextOnly' | 'evidenceKind' | 'source'>,
): boolean {
  return (
    claim.contextOnly === true ||
    (claim.evidenceKind !== undefined && CONTEXT_EVIDENCE_KINDS.has(claim.evidenceKind)) ||
    claim.source?.type === 'market_provider'
  );
}

/** The claims that may be read as builder evidence: everything that is not context. */
export function builderClaims(response: Pick<AgentIntelligenceResponse, 'claims'>): AgentClaim[] {
  return response.claims.filter((claim) => !isContextOnlyClaim(claim));
}

/** Whether a change is market, market-integrity or usage context (production's `isContextChange`). */
export function isContextOnlyChange(change: Pick<AgentChange, 'domain' | 'type'>): boolean {
  return isContextChange(change);
}

/**
 * The Still Building state of a `research_project` answer: HELD, NOT_HELD (measured, not met) or
 * NOT_MEASURED. Read from `stillBuildingState`; when an older answer has none, NOT_MEASURED —
 * never NOT_HELD guessed from `stillBuilding: false`, which v1 sends in both cases.
 */
export function stillBuildingStateOfResearch(
  response: Extract<AgentIntelligenceResponse, { capability: 'research_project' }>,
): StillBuildingState | null {
  if (!response.data) return null;
  return stillBuildingStateOf({ apiState: response.data.builderState.stillBuildingState });
}

const isAgentText = (value: unknown): value is AgentText =>
  typeof value === 'object' && value !== null && 'contentOrigin' in value && 'text' in value;

/** Every AgentText in the response, with its path. */
function texts(value: unknown, path: string, out: { path: string; text: AgentText }[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => texts(item, path ? `${path}.${i}` : String(i), out));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (isAgentText(value)) {
    out.push({ path, text: value });
    return;
  }
  for (const [key, child] of Object.entries(value))
    texts(child, path ? `${path}.${key}` : key, out);
}

function changesOf(response: AgentIntelligenceResponse): { path: string; change: AgentChange }[] {
  if (response.capability === 'what_changed' && response.data) {
    return response.data.items.map((change, i) => ({ path: `data.items.${i}`, change }));
  }
  if (response.capability === 'research_project' && response.data) {
    const out = response.data.recentChanges.items.map((change, i) => ({
      path: `data.recentChanges.items.${i}`,
      change,
    }));
    if (response.data.latestMeaningfulChange)
      out.push({
        path: 'data.latestMeaningfulChange',
        change: response.data.latestMeaningfulChange,
      });
    return out;
  }
  return [];
}

/**
 * Checks a validated response against the rules above. An empty list means none is broken. Run
 * it after `parseAgentResponse`: it reads the typed shape and does not validate it again.
 */
export function checkAgentInvariants(
  response: AgentIntelligenceResponse,
): AgentInvariantViolation[] {
  const violations: AgentInvariantViolation[] = [];
  const add = (code: AgentInvariantCode, path: string, message: string) =>
    violations.push({ code, path, message });

  response.claims.forEach((claim, i) => {
    const path = `claims.${i}`;
    if (claim.status === 'UNKNOWN') {
      if (claim.source !== null)
        add('unknown_claim_with_source', path, 'An UNKNOWN claim names no source.');
      if (claim.value === 0 || claim.value === false || claim.value === '') {
        add(
          'unknown_as_zero_or_false',
          `${path}.value`,
          'An UNKNOWN claim carries null, never 0, false or "".',
        );
      }
    }
    const restsOnContext =
      (claim.evidenceKind !== undefined && CONTEXT_EVIDENCE_KINDS.has(claim.evidenceKind)) ||
      claim.source?.type === 'market_provider';
    if (restsOnContext && claim.contextOnly !== true) {
      add(
        'market_claim_not_context_only',
        path,
        'A claim resting on a market or usage reading is contextOnly.',
      );
    }
  });

  for (const { path, change } of changesOf(response)) {
    if (change.countsAsBuilding && isContextChange(change)) {
      add(
        'context_change_counts_as_building',
        `${path}.countsAsBuilding`,
        `A ${change.type} event is context and never counts as building.`,
      );
    }
  }

  const all: { path: string; text: AgentText }[] = [];
  texts(response, '', all);
  for (const { path, text } of all) {
    if (text.contentOrigin === 'external_source' && !text.source) {
      add(
        'external_text_without_source',
        path,
        'Text from a source says which kind of source it came from.',
      );
    }
    if (
      text.contentOrigin === 'hey' &&
      (text.source !== undefined ||
        text.sourceUrl !== undefined ||
        text.instructionLike !== undefined)
    ) {
      add(
        'hey_text_with_source_fields',
        path,
        "HEY's own words carry no source and no instruction flag.",
      );
    }
  }

  response.unknowns.forEach((unknown, i) => {
    if (unknown.doNotConclude.contentOrigin !== 'hey') {
      add(
        'do_not_conclude_not_hey',
        `unknowns.${i}.doNotConclude`,
        "What not to conclude from a gap is HEY's own sentence.",
      );
    }
  });

  response.disclosures?.forEach((disclosure, i) => {
    if (
      disclosure.code === 'hey_own_token' &&
      (disclosure.statement.text !== HEY_OWN_TOKEN_DISCLOSURE ||
        disclosure.statement.contentOrigin !== 'hey')
    ) {
      add(
        'disclosure_statement_mismatch',
        `disclosures.${i}.statement`,
        `The disclosure reads "${HEY_OWN_TOKEN_DISCLOSURE}".`,
      );
    }
  });

  const conflict = (path: string, held: boolean | null, state: StillBuildingState | undefined) => {
    if (state === undefined) return;
    if ((held === true) !== (state === 'HELD')) {
      add(
        'still_building_state_conflict',
        path,
        'Still Building is true exactly when its state is HELD.',
      );
    }
  };
  if (response.capability === 'research_project' && response.data) {
    conflict(
      'data.builderState',
      response.data.builderState.stillBuilding,
      response.data.builderState.stillBuildingState,
    );
  }
  if (response.capability === 'builder_status' && response.data) {
    conflict(
      'data.stillBuilding',
      response.data.stillBuilding.value,
      response.data.stillBuilding.stillBuildingState,
    );
  }

  if (response.citation && response.citation.capability !== response.capability) {
    add(
      'citation_capability_mismatch',
      'citation.capability',
      'The citation names the capability that answered.',
    );
  }
  if (response.status !== 'ok' && !response.error) {
    add('refusal_without_error', 'error', 'A refused answer says why in error.');
  }
  return violations;
}
