import { describe, expect, it } from 'vitest';

import {
  AGENT_COVERAGE_STATES,
  HEY_EVIDENCE_FAMILIES,
  VALUATION_NOT_PLAUSIBLE_CODES,
  categoryOfCoverage,
  evidenceFamiliesFor,
  isValuationNotPlausible,
  valuationWithheldClause,
  looksLikeEvidenceId,
  unknownCategorySummary,
} from '../src/index';

/** What production's contract added between 0.1.0 (2026-10-02) and 2026-10-09. */
describe('production as of 2026-10-09', () => {
  it('maps the two new coverage states to their unknown categories', () => {
    expect(AGENT_COVERAGE_STATES).toContain('PARTIAL');
    expect(AGENT_COVERAGE_STATES).toContain('MAPPING_BLOCKED');
    expect(categoryOfCoverage('PARTIAL')).toBe('INSUFFICIENT_EVIDENCE');
    expect(categoryOfCoverage('MAPPING_BLOCKED')).toBe('NOT_VERIFIED');
    expect(categoryOfCoverage('MAPPING_BLOCKED', 'site_not_corroborated')).toBe('NOT_VERIFIED');
  });

  it('knows all four valuation-gate reasons', () => {
    expect([...VALUATION_NOT_PLAUSIBLE_CODES]).toEqual([
      'valuation_over_liquidity',
      'unlisted_over_ceiling',
      'chain_evidence_contradicts',
      'sources_disagree',
    ]);
    for (const code of VALUATION_NOT_PLAUSIBLE_CODES)
      expect(isValuationNotPlausible(code)).toBe(true);
    expect(isValuationNotPlausible('market_too_thin')).toBe(false);
    expect(valuationWithheldClause('sources_disagree')).toContain('(sources_disagree)');
    expect(valuationWithheldClause('chain_evidence_contradicts')).toContain('not plausible');
  });

  it('lists the fourteen evidence families production resolves, integrity only where public', () => {
    expect([...HEY_EVIDENCE_FAMILIES]).toEqual([
      'ship',
      'signal',
      'abi',
      'impl',
      'lock',
      'source',
      'claim',
      'state',
      'integrity',
      'narrative',
      'method',
      'sourcechange',
      'security',
      'v4hook',
    ]);
    expect(evidenceFamiliesFor({ marketIntegrityPublic: false })).not.toContain('integrity');
    expect(evidenceFamiliesFor({ marketIntegrityPublic: true })).toHaveLength(14);
  });

  it('tells an evidence id from an event id by shape', () => {
    expect(looksLikeEvidenceId('sourcechange:0b0d6f3e-8f8e-4e44-9a51-1b7f4a3f0e11')).toBe(true);
    expect(looksLikeEvidenceId('v4hook:4663:0x0000000000000000000000000000000000000001')).toBe(
      true,
    );
    expect(looksLikeEvidenceId('source:0b0d6f3e-8f8e-4e44-9a51-1b7f4a3f0e11:added')).toBe(false);
    expect(looksLikeEvidenceId('wallet:0x01')).toBe(false);
  });

  it('summarises unknowns by category in the fixed order', () => {
    expect(
      unknownCategorySummary([
        { category: 'NOT_VERIFIED' },
        { category: 'NOT_MEASURED' },
        { category: 'NOT_MEASURED' },
      ]),
    ).toBe('2 NOT_MEASURED, 1 NOT_VERIFIED');
    expect(unknownCategorySummary([])).toBe('');
  });
});
