import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import * as contract from '../src/index';
import {
  buildJsonSchemas,
  serialise,
  STRICT_FILE,
  TOLERANT_FILE,
} from '../scripts/json-schema.mjs';
import { edgeIndex, live, liveIndex, readJson, readText } from './helpers';

const strictSchema = readJson<object>('schema', STRICT_FILE);
const tolerantSchema = readJson<object>('schema', TOLERANT_FILE);

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStrict = ajv.compile(strictSchema);
const validateTolerant = ajv.compile(tolerantSchema);

describe('the generated JSON Schemas (schema/)', () => {
  it('are committed exactly as a fresh build from the Zod schemas writes them', () => {
    const fresh = buildJsonSchemas(contract);
    expect(readText('schema', STRICT_FILE)).toBe(serialise(fresh.strict));
    expect(readText('schema', TOLERANT_FILE)).toBe(serialise(fresh.tolerant));
  });

  it('name the contract and the commit they describe', () => {
    expect(strictSchema).toMatchObject({
      $id: `https://raw.githubusercontent.com/hey-research-lab/hey-agent-contract/main/schema/${STRICT_FILE}`,
      'x-hey-contract': {
        schema: contract.AGENT_SCHEMA,
        schemaVersion: '1',
        productionCommit: contract.PRODUCTION_CONTRACT_COMMIT,
        productionAsOf: contract.PRODUCTION_CONTRACT_AS_OF,
      },
    });
  });

  it('accept every recorded live answer', () => {
    for (const entry of liveIndex().filter((e) => e.name !== 'refusal.unknown_capability')) {
      expect(
        validateStrict(live<unknown>(entry.name)),
        `${entry.name}: ${ajv.errorsText(validateStrict.errors)}`,
      ).toBe(true);
      expect(validateTolerant(live<unknown>(entry.name)), entry.name).toBe(true);
    }
  });

  it('agree with the Zod schema on every shape-level edge case', () => {
    // The JSON Schemas are the Zod shape only: the chain rule and the pre-checks live in the
    // package's parse functions, so only shape refusals are compared here.
    const shapeOnly = edgeIndex().filter(
      (e) =>
        !e.expect.parseText &&
        [
          'valid',
          'invalid_response',
          'unsupported_capability',
          'unsupported_schema_version',
        ].includes(e.expect.strict),
    );
    expect(shapeOnly.length).toBeGreaterThan(10);
    for (const { file, expect: want } of shapeOnly) {
      const body = readJson<unknown>('fixtures', 'edge', file);
      expect(validateStrict(body), file).toBe(want.strict === 'valid');
      if (want.tolerant) expect(validateTolerant(body), file).toBe(want.tolerant === 'valid');
    }
  });
});
