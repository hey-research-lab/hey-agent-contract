import { z } from 'zod';

import type { AgentIntelligenceResponse } from './contract/schema';
import {
  safeParseAgentResponse,
  type AgentContractError,
  type AgentParseOptions,
} from './validate';

/**
 * HEY's public API error envelope (`{ error, message, requestId, retryable, retryAfterSeconds? }`).
 * `GET /api/agent/{capability}` answers in it only when the capability itself is unknown (404);
 * every other refusal is the agent contract's own envelope. It is not part of the agent contract:
 * unknown fields are ignored, and `error` is an open code.
 */
export const heyApiErrorSchema = z.object({
  error: z.string().max(80),
  message: z.string().max(2000),
  requestId: z.string().max(120).optional(),
  retryable: z.boolean().optional(),
  retryAfterSeconds: z.number().int().min(0).optional(),
});
export type HeyApiError = z.infer<typeof heyApiErrorSchema>;

/** The error codes HEY's public API documents for this envelope. */
export const HEY_API_ERROR_CODES = [
  'bad_request',
  'invalid_parameter',
  'invalid_address',
  'batch_too_large',
  'unauthorized',
  'key_required',
  'forbidden',
  'not_found',
  'payload_too_large',
  'rate_limited',
  'quota',
  'internal_error',
  'service_unavailable',
] as const;

export type AgentHttpBody =
  | { kind: 'answer'; response: AgentIntelligenceResponse; ignoredFields: readonly string[] }
  | { kind: 'api_error'; error: HeyApiError }
  | { kind: 'invalid'; error: AgentContractError };

/**
 * Reads the JSON body of a `GET /api/agent/{capability}` reply, whatever its HTTP status: the
 * contract's envelope (an answer or a refusal), HEY's API error envelope, or neither.
 */
export function readAgentHttpBody(body: unknown, options: AgentParseOptions = {}): AgentHttpBody {
  const answer = safeParseAgentResponse(body, options);
  if (answer.success)
    return { kind: 'answer', response: answer.data, ignoredFields: answer.ignoredFields };
  const isEnvelope = typeof body === 'object' && body !== null && 'schema' in body;
  if (!isEnvelope) {
    const apiError = heyApiErrorSchema.safeParse(body);
    if (apiError.success) return { kind: 'api_error', error: apiError.data };
  }
  return { kind: 'invalid', error: answer.error };
}
