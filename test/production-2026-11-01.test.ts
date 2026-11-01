import { describe, expect, it } from 'vitest';

import {
  AGENT_CAPABILITIES,
  HEY_EVIDENCE_FAMILIES,
  UNDER_THE_RADAR_STATES,
  checkAgentInvariants,
  isAgentCapability,
  isContextOnlyChange,
  looksLikeEvidenceId,
  parseAgentResponse,
  type AgentResponseOf,
} from '../src/index';
import { clone, live } from './helpers';

/** What production's contract added between 0.2.0 (2026-10-09) and 2026-11-01. */
describe('production as of 2026-11-01', () => {
  it('answers a seventh capability, chain_brief, last in the list', () => {
    expect(AGENT_CAPABILITIES.at(-1)).toBe('chain_brief');
    expect(isAgentCapability('chain_brief')).toBe(true);
    expect(isAgentCapability('price_prediction')).toBe(false);
    const brief = parseAgentResponse(live('chain_brief')) as AgentResponseOf<'chain_brief'>;
    expect(brief.capability).toBe('chain_brief');
    expect(brief.citation?.capability).toBe('chain_brief');
    expect(checkAgentInvariants(brief)).toEqual([]);
  });

  it('carries the citation as a sentence on every answer', () => {
    const answer = parseAgentResponse(live('research_project'));
    expect(answer.citation?.text).toMatch(/^Source: HEY Research Lab/);
    const without = clone(live<Record<string, { text?: string }>>('research_project'));
    delete without.citation!.text;
    expect(() => parseAgentResponse(without)).toThrow(/citation\.text: Required/);
  });

  it('states Under the Radar in three states, restated from the API', () => {
    expect([...UNDER_THE_RADAR_STATES]).toEqual(['HELD', 'NOT_HELD', 'NOT_MEASURED']);
    const answer = parseAgentResponse(
      live('research_project'),
    ) as AgentResponseOf<'research_project'>;
    const state = answer.data?.builderState.underTheRadar?.state;
    if (state !== undefined) expect(UNDER_THE_RADAR_STATES).toContain(state);
  });

  it('reads new Uniswap v4 pools on a hook as context, never building', () => {
    expect(isContextOnlyChange({ domain: 'contract', type: 'contract.v4_pool_initialized' })).toBe(
      true,
    );
  });

  it('resolves the two new evidence families', () => {
    expect(HEY_EVIDENCE_FAMILIES).toContain('v4pool');
    expect(HEY_EVIDENCE_FAMILIES).toContain('ponsgrad');
    expect(looksLikeEvidenceId('ponsgrad:4663:0x0000000000000000000000000000000000000001')).toBe(
      true,
    );
  });
});
