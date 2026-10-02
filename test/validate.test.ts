import { describe, expect, it } from 'vitest';

import {
  AgentContractError,
  MAX_RESPONSE_TEXT_BYTES,
  parseAgentResponse,
  parseAgentResponseText,
  readAgentHttpBody,
  safeParseAgentResponse,
  safeParseAgentResponseText,
} from '../src/index';
import { clone, live, readText } from './helpers';

const notFound = () => clone(live<Record<string, unknown>>('refusal.not_found'));

describe('safeParseAgentResponse', () => {
  it('refuses what is not an agent response', () => {
    for (const input of [null, 1, 'x', [], {}, { schema: 'something.else' }]) {
      const result = safeParseAgentResponse(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('not_an_agent_response');
    }
  });

  it('refuses a prototype-polluting key anywhere, even with unknown fields allowed', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const body = JSON.parse(
        JSON.stringify(notFound()).replace(
          '"data":null',
          `"data":null,"query2":{"${key}":{"x":1}}`,
        ),
      ) as unknown;
      for (const allowUnknownFields of [false, true]) {
        const result = safeParseAgentResponse(body, { allowUnknownFields });
        expect(result.success, key).toBe(false);
        if (!result.success) expect(result.error.code).toBe('forbidden_key');
      }
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('refuses nesting deeper than any answer has', () => {
    const body = notFound();
    let deep: Record<string, unknown> = {};
    body.extra = deep;
    for (let i = 0; i < 80; i += 1) {
      const next: Record<string, unknown> = {};
      deep.n = next;
      deep = next;
    }
    const result = safeParseAgentResponse(body, { allowUnknownFields: true });
    expect(result.success).toBe(false);
  });

  it('reports every issue with its path', () => {
    const body = notFound();
    body.answerStatus = 'MAYBE';
    body.asOf = 'yesterday';
    const result = safeParseAgentResponse(body);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentContractError);
      expect(result.error.issues.map((issue) => issue.path).sort()).toEqual([
        'answerStatus',
        'asOf',
      ]);
    }
  });

  it('does not let unknown-field tolerance hide a real error', () => {
    const body = notFound();
    body.newField = true;
    body.answerStatus = 'MAYBE';
    const result = safeParseAgentResponse(body, { allowUnknownFields: true });
    expect(result.success).toBe(false);
  });

  it('never mutates its input', () => {
    const body = notFound();
    body.newField = true;
    const before = JSON.stringify(body);
    safeParseAgentResponse(body, { allowUnknownFields: true });
    expect(JSON.stringify(body)).toBe(before);
  });

  it('throws AgentContractError from the throwing form', () => {
    expect(() => parseAgentResponse({})).toThrow(AgentContractError);
  });
});

describe('safeParseAgentResponseText', () => {
  it('parses recorded text', () => {
    expect(
      parseAgentResponseText(readText('fixtures', 'live', 'research_project.json')).capability,
    ).toBe('research_project');
  });

  it('refuses text over the cap before parsing it', () => {
    const result = safeParseAgentResponseText(' '.repeat(MAX_RESPONSE_TEXT_BYTES + 1));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('response_too_large');
    const small = safeParseAgentResponseText(
      readText('fixtures', 'live', 'research_project.json'),
      { maxBytes: 1000 },
    );
    expect(small.success).toBe(false);
  });

  it('refuses text that is not JSON', () => {
    const result = safeParseAgentResponseText('{"schema":');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('invalid_json');
  });

  it('refuses a __proto__ key in the text', () => {
    const result = safeParseAgentResponseText(
      readText('fixtures', 'edge', 'invalid.proto_key.json'),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('forbidden_key');
  });
});

describe('readAgentHttpBody', () => {
  it('tells an answer, a refusal envelope and an API error apart', () => {
    expect(readAgentHttpBody(live('research_project')).kind).toBe('answer');
    expect(readAgentHttpBody(live('refusal.not_found')).kind).toBe('answer');
    expect(readAgentHttpBody(live('refusal.unknown_capability')).kind).toBe('api_error');
    expect(readAgentHttpBody({ nothing: true }).kind).toBe('invalid');
    expect(
      readAgentHttpBody({ schema: 'hey.agent-intelligence-response', error: 'x', message: 'y' })
        .kind,
    ).toBe('invalid');
  });
});
