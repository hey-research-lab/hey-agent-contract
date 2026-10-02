/**
 * `@hey-research-lab/agent-contract`: the public contract of HEY's agent answers,
 * AgentIntelligenceResponse v1.
 *
 * `src/contract/` is a byte-for-byte copy of the pure modules of HEY's production contract (see
 * PARITY.json); the rest of this package adds client-side validation around it. Importing it has
 * no side effect and makes no network call.
 */
export * from './contract/capabilities';
export * from './contract/schema';
export * from './contract/evidence-kinds';
export * from './contract/disclosures';
export * from './contract/text';
export * from './contract/words';
export * from './contract/freshness';
export * from './contract/unknowns';
export * from './contract/records';
export * from './contract/request';
export * from './contract/excerpts';
export * from './vocabulary';
export * from './chain';
export * from './version';
export * from './validate';
export * from './invariants';
export * from './api-error';
