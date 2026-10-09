import { AGENT_SCHEMA, AGENT_SCHEMA_VERSION } from './contract/schema';
import { MACHINE_TEXT_VERSION } from './contract/text';
import { AGENT_FRESHNESS_VERSION } from './contract/freshness';

/** This package's version (SemVer, independent of the contract's schema version). */
export const PACKAGE_VERSION = '0.2.0' as const;

/**
 * The commit the files in `src/contract/` were copied from, byte for byte. Since 0.2.0 it is a
 * commit of the public mirror https://github.com/hey-research-lab/hey-research-open, so anyone can
 * check the copy (`pnpm parity:source`); 0.1.0 recorded the production commit it mirrors.
 */
export const PRODUCTION_CONTRACT_COMMIT = '23d0813d81edb1cba0f489977df44fb9a96274c8' as const;

/** The production state the copy matches (UTC date). */
export const PRODUCTION_CONTRACT_AS_OF = '2026-10-09' as const;

/**
 * The contract this package describes. `schema` and `schemaVersion` are the values every
 * AgentIntelligenceResponse carries; `machineText` and `freshness` are the versions of the text
 * and freshness rules it was extracted with.
 */
export const AGENT_CONTRACT_VERSION = {
  schema: AGENT_SCHEMA,
  schemaVersion: AGENT_SCHEMA_VERSION,
  machineText: MACHINE_TEXT_VERSION,
  freshness: AGENT_FRESHNESS_VERSION,
  productionCommit: PRODUCTION_CONTRACT_COMMIT,
  productionAsOf: PRODUCTION_CONTRACT_AS_OF,
  packageVersion: PACKAGE_VERSION,
} as const;
