import type { ZodIssue } from 'zod';

import { CHAIN_ID, UnsupportedChainError } from './chain';
import { AGENT_CAPABILITIES, type AgentCapability } from './contract/capabilities';
import { parseAgentRequest, type ParsedAgentRequest } from './contract/request';
import {
  AGENT_SCHEMA,
  AGENT_SCHEMA_VERSION,
  agentIntelligenceResponseSchema,
  type AgentIntelligenceResponse,
} from './contract/schema';

/**
 * Validation of HEY agent answers (AgentIntelligenceResponse v1).
 *
 * The Zod schema is production's, unchanged. These functions add what a client needs around it:
 * a clear code for each kind of refusal, the Robinhood-Chain-only rule (`unsupported_chain`), a
 * guard against prototype-polluting keys, a size cap for raw text, and an opt-in tolerance for
 * fields added to v1 after this package was cut. Nothing is coerced: a value that validates is
 * returned exactly as it was given.
 */

export type AgentContractErrorCode =
  /** The text is not JSON. */
  | 'invalid_json'
  /** The text is larger than the cap. */
  | 'response_too_large'
  /** An object key that could pollute a prototype: `__proto__`, `constructor` or `prototype`. */
  | 'forbidden_key'
  /** Not an object, or `schema` is not `hey.agent-intelligence-response`. */
  | 'not_an_agent_response'
  /** `schemaVersion` is not "1" (a semantic change is a new version served beside v1). */
  | 'unsupported_schema_version'
  /** `capability` is not one of the six. */
  | 'unsupported_capability'
  /** A chain id other than 4663 (Robinhood Chain). */
  | 'unsupported_chain'
  /** The shape does not match AgentIntelligenceResponse v1. */
  | 'invalid_response';

export type AgentContractIssue = {
  /** Dotted path into the response (`claims.3.status`); empty for the root. */
  path: string;
  message: string;
  /** Zod's issue code, or this package's error code for its own checks. */
  code: string;
};

export class AgentContractError extends Error {
  override readonly name = 'AgentContractError';
  constructor(
    readonly code: AgentContractErrorCode,
    message: string,
    readonly issues: readonly AgentContractIssue[] = [],
  ) {
    super(message);
  }
}

export type AgentParseOptions = {
  /**
   * Accept fields this package does not know yet (default `false`). HEY's v1 is additive: a new
   * field may appear and never changes meaning, and HEY's OpenAPI document tells clients to ignore
   * fields they do not know. With `true`, unknown fields are removed from the returned value and
   * listed in `ignoredFields`; every known field is still validated strictly. Keys that could
   * pollute a prototype are refused either way.
   */
  allowUnknownFields?: boolean;
};

export type AgentParseResult =
  | { success: true; data: AgentIntelligenceResponse; ignoredFields: readonly string[] }
  | { success: false; error: AgentContractError };

/** Whether `value` is one of HEY's six agent capabilities. */
export function isSupportedCapability(value: unknown): value is AgentCapability {
  return typeof value === 'string' && (AGENT_CAPABILITIES as readonly string[]).includes(value);
}

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pathOf = (path: readonly (string | number)[]): string => path.map(String).join('.');

/** The first own key anywhere in `value` that could pollute a prototype, or nesting too deep. */
function unsafeKey(value: unknown, path: (string | number)[] = []): AgentContractIssue | null {
  if (path.length > MAX_DEPTH) {
    return { path: pathOf(path), message: `nested deeper than ${MAX_DEPTH}`, code: 'too_deep' };
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = unsafeKey(value[i], [...path, i]);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return {
        path: pathOf([...path, key]),
        message: `forbidden key "${key}"`,
        code: 'forbidden_key',
      };
    }
    const found = unsafeKey(value[key], [...path, key]);
    if (found) return found;
  }
  return null;
}

const toIssue = (issue: ZodIssue): AgentContractIssue => ({
  path: pathOf(issue.path),
  message:
    issue.code === 'unrecognized_keys'
      ? `unknown field(s): ${issue.keys.join(', ')}`
      : issue.message,
  code: issue.code,
});

/** Every chain id a response carries, with its path. */
function chainIds(response: AgentIntelligenceResponse): { path: string; value: number }[] {
  const ids: { path: string; value: number }[] = [
    { path: 'chain.chainId', value: response.chain.chainId },
    { path: 'query.chainId', value: response.query.chainId },
  ];
  const subject = response.subject;
  if (subject?.project?.token)
    ids.push({ path: 'subject.project.token.chainId', value: subject.project.token.chainId });
  subject?.projects?.forEach((project, i) => {
    if (project.token)
      ids.push({ path: `subject.projects.${i}.token.chainId`, value: project.token.chainId });
  });
  if (subject?.contract)
    ids.push({ path: 'subject.contract.chainId', value: subject.contract.chainId });
  if (response.capability === 'research_project' && response.data?.contractIdentity.token) {
    ids.push({
      path: 'data.contractIdentity.token.chainId',
      value: response.data.contractIdentity.token.chainId,
    });
  }
  if (response.capability === 'verify_project' && response.data) {
    ids.push({ path: 'data.chainId', value: response.data.chainId });
  }
  return ids;
}

/** Removes the unknown keys Zod reported, on a copy. Returns the removed paths. */
function withoutUnknownKeys(value: unknown, issues: readonly ZodIssue[]): string[] {
  const removed: string[] = [];
  for (const issue of issues) {
    if (issue.code !== 'unrecognized_keys') continue;
    let target: unknown = value;
    for (const part of issue.path) {
      target =
        isRecord(target) || Array.isArray(target)
          ? (target as Record<string | number, unknown>)[part]
          : undefined;
    }
    if (!isRecord(target)) continue;
    for (const key of issue.keys) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        delete target[key];
        removed.push(pathOf([...issue.path, key]));
      }
    }
  }
  return removed;
}

/**
 * Validates a parsed JSON value as an AgentIntelligenceResponse v1 answered for Robinhood Chain.
 * Never throws; see `parseAgentResponse` for the throwing form.
 */
export function safeParseAgentResponse(
  input: unknown,
  options: AgentParseOptions = {},
): AgentParseResult {
  const fail = (
    code: AgentContractErrorCode,
    message: string,
    issues: AgentContractIssue[] = [],
  ): AgentParseResult => ({
    success: false,
    error: new AgentContractError(code, message, issues),
  });

  if (!isRecord(input)) return fail('not_an_agent_response', 'An agent response is a JSON object.');
  const unsafe = unsafeKey(input);
  if (unsafe) {
    return unsafe.code === 'forbidden_key'
      ? fail('forbidden_key', `The response holds a ${unsafe.message} at ${unsafe.path}.`, [unsafe])
      : fail('invalid_response', `The response is ${unsafe.message}.`, [unsafe]);
  }
  if (input.schema !== AGENT_SCHEMA) {
    return fail('not_an_agent_response', `schema must be "${AGENT_SCHEMA}".`, [
      { path: 'schema', message: `expected "${AGENT_SCHEMA}"`, code: 'not_an_agent_response' },
    ]);
  }
  if (input.schemaVersion !== AGENT_SCHEMA_VERSION) {
    return fail(
      'unsupported_schema_version',
      `This package reads schemaVersion "${AGENT_SCHEMA_VERSION}"; the response is version ${JSON.stringify(input.schemaVersion)}.`,
      [
        {
          path: 'schemaVersion',
          message: `expected "${AGENT_SCHEMA_VERSION}"`,
          code: 'unsupported_schema_version',
        },
      ],
    );
  }
  if (!isSupportedCapability(input.capability)) {
    return fail(
      'unsupported_capability',
      `capability must be one of: ${AGENT_CAPABILITIES.join(', ')}.`,
      [
        {
          path: 'capability',
          message: 'not one of the six capabilities',
          code: 'unsupported_capability',
        },
      ],
    );
  }
  // The chain first: an answer about another chain is refused for that reason, whatever else is wrong.
  const chain = isRecord(input.chain) ? input.chain.chainId : undefined;
  if (chain !== undefined && chain !== CHAIN_ID) {
    const error = new UnsupportedChainError(chain);
    return fail('unsupported_chain', error.message, [
      { path: 'chain.chainId', message: error.message, code: 'unsupported_chain' },
    ]);
  }

  let candidate: unknown = input;
  let ignoredFields: string[] = [];
  let parsed = agentIntelligenceResponseSchema.safeParse(candidate);
  if (!parsed.success && options.allowUnknownFields) {
    try {
      candidate = structuredClone(input);
    } catch {
      return fail('invalid_response', 'The response is not plain JSON data.');
    }
    // Each pass removes the unknown keys Zod reported; a few passes reach any nesting the schema has.
    for (let pass = 0; pass < 8 && !parsed.success; pass += 1) {
      if (!parsed.error.issues.every((issue) => issue.code === 'unrecognized_keys')) break;
      const removed = withoutUnknownKeys(candidate, parsed.error.issues);
      if (removed.length === 0) break;
      ignoredFields = [...ignoredFields, ...removed];
      parsed = agentIntelligenceResponseSchema.safeParse(candidate);
    }
  }
  if (!parsed.success) {
    const issues = parsed.error.issues.map(toIssue);
    const first = issues[0];
    return fail(
      'invalid_response',
      `Not a valid AgentIntelligenceResponse v1${first ? `: ${first.path || '(root)'}: ${first.message}` : ''}.`,
      issues,
    );
  }

  const wrongChain = chainIds(parsed.data).find((entry) => entry.value !== CHAIN_ID);
  if (wrongChain) {
    const error = new UnsupportedChainError(wrongChain.value);
    return fail('unsupported_chain', error.message, [
      { path: wrongChain.path, message: error.message, code: 'unsupported_chain' },
    ]);
  }
  return { success: true, data: parsed.data, ignoredFields };
}

/** Validates a parsed JSON value as an AgentIntelligenceResponse v1; throws `AgentContractError`. */
export function parseAgentResponse(
  input: unknown,
  options: AgentParseOptions = {},
): AgentIntelligenceResponse {
  const result = safeParseAgentResponse(input, options);
  if (!result.success) throw result.error;
  return result.data;
}

/** The default cap for raw response text: four times production's own 64 KiB bound, for pretty-printed JSON. */
export const MAX_RESPONSE_TEXT_BYTES = 256 * 1024;

/**
 * Parses JSON text and validates it. The text is capped (`maxBytes`, default 256 KiB) before it
 * is parsed, and a `__proto__`, `constructor` or `prototype` key is refused.
 */
export function safeParseAgentResponseText(
  text: string,
  options: AgentParseOptions & { maxBytes?: number } = {},
): AgentParseResult {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_TEXT_BYTES;
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) {
    return {
      success: false,
      error: new AgentContractError(
        'response_too_large',
        `The response is ${bytes} bytes; the cap is ${maxBytes}.`,
      ),
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      success: false,
      error: new AgentContractError('invalid_json', 'The response is not valid JSON.'),
    };
  }
  return safeParseAgentResponse(value, options);
}

/** Parses JSON text and validates it; throws `AgentContractError`. */
export function parseAgentResponseText(
  text: string,
  options: AgentParseOptions & { maxBytes?: number } = {},
): AgentIntelligenceResponse {
  const result = safeParseAgentResponseText(text, options);
  if (!result.success) throw result.error;
  return result.data;
}

/**
 * What a refused answer says: `status` other than `ok`, with the machine code and HEY's sentence.
 * Null for an answer HEY gave.
 */
export function refusalOf(response: AgentIntelligenceResponse): {
  status: Exclude<AgentIntelligenceResponse['status'], 'ok'>;
  code: string | null;
  message: string | null;
  movedTo: string | null;
} | null {
  if (response.status === 'ok') return null;
  return {
    status: response.status,
    code: response.error?.code ?? null,
    message: response.error?.message.text ?? null,
    movedTo: response.error?.movedTo ?? null,
  };
}

export type ValidatedAgentRequest =
  ParsedAgentRequest | { ok: false; code: 'unsupported_chain'; message: string };

/**
 * Production's request validator (`parseAgentRequest`) plus the Robinhood-Chain-only rule: a
 * `chainId` other than 4663 is refused with `unsupported_chain`, as HEY's API refuses it. An
 * absent `chainId` means Robinhood Chain.
 */
export function validateAgentRequest(raw: unknown): ValidatedAgentRequest {
  const parsed = parseAgentRequest(raw);
  if (!parsed.ok) return parsed;
  const { chainId } = parsed.request;
  if (chainId !== undefined && chainId !== CHAIN_ID) {
    return {
      ok: false,
      code: 'unsupported_chain',
      message: new UnsupportedChainError(chainId).message,
    };
  }
  return parsed;
}
