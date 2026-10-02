import { describe, expect, it } from 'vitest';

import {
  AGENT_CAPABILITIES,
  CHAIN_ID,
  checkAgentInvariants,
  parseAgentResponse,
  readAgentHttpBody,
  refusalOf,
  restStatusOf,
  safeParseAgentResponse,
  safeParseAgentResponseText,
  type AgentIntelligenceResponse,
} from '../src/index';
import { edgeIndex, live, liveFiles, liveIndex, readJson, readText } from './helpers';

describe('recorded live answers (GET /api/agent/{capability})', () => {
  const answers = liveIndex().filter((entry) => entry.name !== 'refusal.unknown_capability');

  it('records one answer for each of the six capabilities', () => {
    const capabilities = new Set(answers.map((entry) => live(entry.name).capability));
    expect([...capabilities].sort()).toEqual([...AGENT_CAPABILITIES].sort());
  });

  it('indexes every recorded file', () => {
    expect(
      liveIndex()
        .map((entry) => `${entry.name}.json`)
        .sort(),
    ).toEqual(liveFiles().sort());
  });

  for (const entry of answers) {
    describe(entry.name, () => {
      const raw = live<unknown>(entry.name);

      it('validates strictly, with nothing ignored', () => {
        const result = safeParseAgentResponse(raw);
        if (!result.success) throw result.error;
        expect(result.ignoredFields).toEqual([]);
      });

      it('comes back exactly as given (no coercion, no default, no dropped field)', () => {
        expect(parseAgentResponse(raw)).toEqual(raw);
      });

      it('keeps every rule production keeps', () => {
        expect(checkAgentInvariants(parseAgentResponse(raw))).toEqual([]);
      });

      it('answers for Robinhood Chain', () => {
        const response = parseAgentResponse(raw);
        expect(response.chain.chainId).toBe(CHAIN_ID);
        expect(response.query.chainId).toBe(CHAIN_ID);
      });

      it('was served with the HTTP status its status maps to', () => {
        expect(restStatusOf(parseAgentResponse(raw))).toBe(entry.httpStatus);
      });
    });
  }

  it('reads the refusals production sends', () => {
    const chain = parseAgentResponse(live('refusal.unsupported_chain'));
    expect(refusalOf(chain)).toMatchObject({
      status: 'invalid_request',
      code: 'unsupported_chain',
    });
    expect(chain.data).toBeNull();
    expect(chain.answerStatus).toBe('UNKNOWN');
    const missing = parseAgentResponse(live('refusal.not_found'));
    expect(refusalOf(missing)).toMatchObject({ status: 'not_found', code: 'not_found' });
    expect(refusalOf(parseAgentResponse(live('research_project')))).toBeNull();
  });

  it('reads an unknown capability as HEY’s API error envelope, not an answer', () => {
    const body = readAgentHttpBody(live<unknown>('refusal.unknown_capability'));
    expect(body.kind).toBe('api_error');
    if (body.kind === 'api_error') expect(body.error.error).toBe('not_found');
    expect(safeParseAgentResponse(live<unknown>('refusal.unknown_capability')).success).toBe(false);
  });

  it('discloses HEY’s own token wherever its project appears', () => {
    for (const name of ['verify_project.hey_own_token', 'compare_builders']) {
      const response = live<AgentIntelligenceResponse>(name);
      expect(response.disclosures?.map((d) => d.code)).toEqual(['hey_own_token']);
    }
  });
});

describe('hand-made edge cases (fixtures/edge/index.json)', () => {
  for (const { file, description, expect: want } of edgeIndex()) {
    it(`${file}: ${description}`, () => {
      const text = readText('fixtures', 'edge', file);
      const strict = want.parseText
        ? safeParseAgentResponseText(text)
        : safeParseAgentResponse(readJson(`fixtures/edge/${file}`));
      if (want.strict === 'valid') {
        if (!strict.success) throw strict.error;
      } else {
        expect(strict.success).toBe(false);
        if (!strict.success) {
          expect(strict.error.code).toBe(want.strict);
          if (want.path)
            expect(strict.error.issues.map((issue) => issue.path)).toContain(want.path);
        }
      }
      if (want.tolerant) {
        const tolerant = safeParseAgentResponse(readJson(`fixtures/edge/${file}`), {
          allowUnknownFields: true,
        });
        expect(tolerant.success).toBe(want.tolerant === 'valid');
        if (tolerant.success)
          expect([...tolerant.ignoredFields].sort()).toEqual(
            [...(want.ignoredFields ?? [])].sort(),
          );
      }
      if (want.invariants) {
        const valid = strict.success
          ? strict
          : safeParseAgentResponse(readJson(`fixtures/edge/${file}`), { allowUnknownFields: true });
        if (!valid.success) throw valid.error;
        expect(checkAgentInvariants(valid.data).map((violation) => violation.code)).toEqual(
          want.invariants,
        );
      }
    });
  }
});
