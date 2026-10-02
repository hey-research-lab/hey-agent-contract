// Types for scripts/json-schema.mjs, so the tests can import it under strict TypeScript.
export declare const STRICT_FILE: string;
export declare const TOLERANT_FILE: string;
export declare function buildJsonSchemas(contract: object): {
  strict: Record<string, unknown>;
  tolerant: Record<string, unknown>;
};
export declare function serialise(schema: unknown): string;
