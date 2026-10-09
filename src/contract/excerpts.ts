/**
 * Public vocabulary that HEY's production contract keeps beside its composers and transport
 * adapters. Only these pure constants and functions are copied, byte for byte, between the
 * `<verbatim>` markers; the composers and adapters themselves are not part of this package.
 * `pnpm parity:source` checks each block against a checkout of the production contract.
 */
import type { AgentIntelligenceResponse } from './schema';

// <verbatim from="compose/common.ts">
/** What HEY never returns, as machine codes (readiness §26): research only, never a trade. */
export const AGENT_NOT_PROVIDED = [
  'investment_recommendation',
  'buy_or_sell_signal',
  'price_prediction',
  'price_target',
  'position_size',
  'leverage',
  'stop_loss',
  'ranking_by_expected_return',
  'risk_score',
  'safety_verdict',
  'smart_money_label',
  'wallet_pnl',
  'wallet_profile',
] as const;
// </verbatim>

// <verbatim from="compose/common.ts">
/** Change domains and types whose events are context, never building (2026-09-30): market readings, market integrity, product usage. */
const CONTEXT_DOMAINS: ReadonlySet<string> = new Set(['market', 'market_integrity']);
const CONTEXT_TYPES: ReadonlySet<string> = new Set(['contract.usage_changed', 'contract.method_first_observed', 'contract.method_resumed']);
export const isContextChange = (change: { domain: string; type: string }): boolean => CONTEXT_DOMAINS.has(change.domain) || CONTEXT_TYPES.has(change.type);
// </verbatim>

// <verbatim from="adapters/provider.ts">
/** The fields no adapter may drop: what makes a HEY answer HEY's. */
export const ADAPTER_REQUIRED_FIELDS = ['answer', 'answerStatus', 'claims', 'unknowns', 'freshness', 'evidence', 'boundaries', 'asOf', 'schemaVersion'] as const;
// </verbatim>

// <verbatim from="adapters/provider.ts">
/** The HTTP status a REST answer carries: the body is the same envelope in every case. */
export function restStatusOf(response: Pick<AgentIntelligenceResponse, 'status'>): number {
  switch (response.status) {
    case 'ok':
      return 200;
    case 'moved':
      return 308;
    case 'invalid_request':
      return 400;
    case 'not_found':
    case 'unavailable':
      return 404;
  }
}
// </verbatim>

/**
 * The typed evidence id families HEY resolves at `https://heyresearch.xyz/api/evidence/{id}`, and
 * production's shape check for an evidence id (an event id with a suffix such as
 * `source:<uuid>:added` is not one). Since 0.2.0 (production as of 2026-10-09).
 */
// <verbatim from="compose/common.ts">
export const HEY_EVIDENCE_FAMILIES = ['ship', 'signal', 'abi', 'impl', 'lock', 'source', 'claim', 'state', 'integrity', 'narrative', 'method', 'sourcechange', 'security', 'v4hook'] as const;
/** The families as a reader lists them: `integrity:` only where Market Integrity is public. */
export function evidenceFamiliesFor(options: { marketIntegrityPublic: boolean }): readonly string[] {
  return HEY_EVIDENCE_FAMILIES.filter((family) => options.marketIntegrityPublic || family !== 'integrity');
}
const EVIDENCE_FAMILIES: ReadonlySet<string> = new Set(HEY_EVIDENCE_FAMILIES);
export function looksLikeEvidenceId(id: string): boolean {
  const family = id.split(':')[0] ?? '';
  return EVIDENCE_FAMILIES.has(family) && /^[a-z][a-z0-9]*:[A-Za-z0-9:._-]{1,220}$/.test(id) && !/:(added|removed|restored|unavailable|changed)$/.test(id);
}
// </verbatim>
