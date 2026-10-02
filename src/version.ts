import { AGENT_SCHEMA, AGENT_SCHEMA_VERSION } from './contract/schema';
import { MACHINE_TEXT_VERSION } from './contract/text';
import { AGENT_FRESHNESS_VERSION } from './contract/freshness';

/** This package's version (SemVer, independent of the contract's schema version). */
export const PACKAGE_VERSION = '0.1.0' as const;

/** The production commit the files in `src/contract/` were copied from, byte for byte. */
export const PRODUCTION_CONTRACT_COMMIT = '21775391f6c0fb4494575e0b4463df535c65cb96' as const;

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
  packageVersion: PACKAGE_VERSION,
} as const;
