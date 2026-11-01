// Builds the JSON Schemas of AgentIntelligenceResponse v1 from the package's Zod schemas.
// Shared by scripts/build-schema.mjs (writes schema/ from dist/) and the test that holds the
// committed files equal to a fresh build from src/.
//
// Since 0.3.0 the generator is zod 4's own `z.toJSONSchema` (zod-to-json-schema reads zod 3 only).
import { z } from 'zod';

const REPO_SCHEMA_BASE =
  'https://raw.githubusercontent.com/hey-research-lab/hey-agent-contract/main/schema';
export const STRICT_FILE = 'agent-intelligence-response.v1.json';
export const TOLERANT_FILE = 'agent-intelligence-response.v1.tolerant.json';

/** Removes every `additionalProperties: false`: v1 is additive, so a reader may meet newer fields. */
function tolerant(node) {
  if (Array.isArray(node)) return node.map(tolerant);
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'additionalProperties' && value === false) continue;
    out[key] = tolerant(value);
  }
  return out;
}

/** `contract` is the package module (src/index.ts under the test runner, dist/index.js at build). */
export function buildJsonSchemas(contract) {
  // The shared parts, each written once under `definitions` and referenced by name.
  const definitions = z.registry();
  for (const [id, schema] of Object.entries({
    AgentText: contract.agentTextSchema,
    AgentEvidenceRef: contract.agentEvidenceRefSchema,
    AgentClaim: contract.agentClaimSchema,
    AgentUnknown: contract.agentUnknownSchema,
    AgentFreshness: contract.agentFreshnessSchema,
    AgentChange: contract.agentChangeSchema,
    AgentDisclosure: contract.agentDisclosureSchema,
  })) {
    definitions.add(schema, { id });
  }
  // `io: 'input'`: the schema describes the JSON a reader receives and parses.
  const generated = z.toJSONSchema(contract.agentIntelligenceResponseSchema, {
    target: 'draft-7',
    io: 'input',
    metadata: definitions,
  });
  const { $schema, ...body } = generated;
  const header = (file, title, description) => ({
    $schema,
    $id: `${REPO_SCHEMA_BASE}/${file}`,
    title,
    description,
    'x-hey-contract': {
      schema: contract.AGENT_SCHEMA,
      schemaVersion: contract.AGENT_SCHEMA_VERSION,
      productionCommit: contract.PRODUCTION_CONTRACT_COMMIT,
      productionAsOf: contract.PRODUCTION_CONTRACT_AS_OF,
      generatedFrom: '@hey-research-lab/agent-contract (Zod), by z.toJSONSchema (zod 4)',
    },
  });
  const strict = {
    ...header(
      STRICT_FILE,
      'AgentIntelligenceResponse v1 (strict)',
      "HEY Research Lab's agent answer, exactly as the production Zod schema at the recorded commit: unknown fields are refused. Generated; do not edit.",
    ),
    ...body,
  };
  const loose = {
    ...header(
      TOLERANT_FILE,
      'AgentIntelligenceResponse v1 (tolerant)',
      "HEY Research Lab's agent answer, accepting fields added to v1 after the recorded commit (v1 is additive: a new field never changes meaning; ignore fields you do not know). Generated; do not edit.",
    ),
    ...tolerant(body),
  };
  return { strict, tolerant: loose };
}

export const serialise = (schema) => `${JSON.stringify(schema, null, 2)}\n`;
