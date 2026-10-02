# hey-agent-contract

The public contract of HEY Research Lab's agent answers — **AgentIntelligenceResponse v1** — as Zod
schemas, TypeScript types, vocabularies, a generated JSON Schema, recorded example responses and
test vectors.

[![CI](https://github.com/hey-research-lab/hey-agent-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/hey-research-lab/hey-agent-contract/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Node >=18](https://img.shields.io/badge/node-%3E%3D18-informational)
![Robinhood Chain 4663](https://img.shields.io/badge/Robinhood%20Chain-4663-informational)

## Why it exists

HEY answers six research questions for AI agents — over REST (`/api/agent/{capability}`), its
hosted MCP server and A2A — in one transport-neutral shape. Until now that shape lived only inside
HEY's codebase. This package lets anyone validate a HEY answer, type it, and build or test tooling
against it without reading HEY's code or calling HEY at test time.

The schemas are not a re-description: `src/contract/` is a byte-for-byte copy of the pure modules
of HEY's production contract at a recorded commit ([PARITY.json](./PARITY.json)), with tests that
fail if a copy is edited and a parity test against production's published OpenAPI document and
agent catalogue.

## Why Robinhood Chain only

HEY researches projects on Robinhood Chain (chain id `4663`, CAIP-2 `eip155:4663`) and nothing
else. `parseAgentResponse` refuses an answer that names any other chain, and
`validateAgentRequest` refuses a request for one, with the code **`unsupported_chain`** — the code
HEY's API itself uses.

## Install

```sh
npm i @hey-research-lab/agent-contract
# or: pnpm add @hey-research-lab/agent-contract
```

One runtime dependency: `zod` (^3.24). ESM and CommonJS, Node 18 or newer, no network access.

## Smallest working example

Runs offline, over a response recorded from HEY's live API and shipped with the package:

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  parseAgentResponseText,
  checkAgentInvariants,
  builderClaims,
} from '@hey-research-lab/agent-contract';

const require = createRequire(import.meta.url);
const file =
  require.resolve('@hey-research-lab/agent-contract/fixtures/live/research_project.json');

const answer = parseAgentResponseText(readFileSync(file, 'utf8')); // throws AgentContractError if not v1
console.log(answer.capability, answer.answer.text); // "research_project", HEY's one-sentence answer
console.log(checkAgentInvariants(answer)); // [] — no rule broken
console.log(builderClaims(answer).map((c) => c.id)); // claims that may be read as builder evidence
```

Against the live API (one request; HEY allows 120 a minute without a key):

```ts
import { readAgentHttpBody } from '@hey-research-lab/agent-contract';

const res = await fetch('https://heyresearch.xyz/api/agent/builder_status?project=agentos');
const body = readAgentHttpBody(await res.json(), { allowUnknownFields: true });
if (body.kind === 'answer') console.log(body.response.status, body.response.answer.text);
else if (body.kind === 'api_error') console.log(body.error.error, body.error.message);
else console.error(body.error.code, body.error.issues);
```

## How to validate a HEY response

| Function                                                             | Use                                                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `parseAgentResponse(value, opts?)`                                   | Validate a parsed JSON value; returns the typed answer or throws `AgentContractError`.                                                   |
| `safeParseAgentResponse(value, opts?)`                               | Same, never throws: `{ success, data, ignoredFields }` or `{ success: false, error }`.                                                   |
| `parseAgentResponseText(text, opts?)` / `safeParseAgentResponseText` | Size-capped (`maxBytes`, default 256 KiB) `JSON.parse`, then the above.                                                                  |
| `readAgentHttpBody(body, opts?)`                                     | Any `/api/agent/{capability}` reply body: an answer or refusal envelope, HEY's API error envelope (unknown capability, 404), or invalid. |
| `refusalOf(response)`                                                | For `status` ≠ `ok`: `{ status, code, message, movedTo }`.                                                                               |
| `checkAgentInvariants(response)`                                     | Rules production keeps that a shape cannot express (below). `[]` when none is broken.                                                    |
| `validateAgentRequest(raw)`                                          | Production's request validator plus the Robinhood-Chain-only rule.                                                                       |
| `isSupportedCapability(value)`                                       | One of the six capabilities.                                                                                                             |

`AgentContractError.code` is one of: `invalid_json`, `response_too_large`, `forbidden_key`
(`__proto__`, `constructor` or `prototype` anywhere), `not_an_agent_response`,
`unsupported_schema_version`, `unsupported_capability`, `unsupported_chain`, `invalid_response`.
`issues[]` lists each problem with its dotted path.

Nothing is coerced. A value that validates comes back exactly as given (the tests assert deep
equality on every recorded answer): `UNKNOWN` is never re-cased, `null` never becomes `0` or
`false`, and no default is filled in.

**Unknown fields.** The Zod schema is production's and is strict: a field it does not know is an
error. HEY's v1 is additive — a field may be added and never changes meaning — and its OpenAPI
document tells clients to ignore fields they do not know. Pass `{ allowUnknownFields: true }` to do
that: unknown fields are removed from the returned value and listed in `ignoredFields`; every known
field is still validated strictly. Use strict mode in tests of your own tooling, tolerant mode
against the live API.

**Invariants** (`checkAgentInvariants`), each a rule HEY's composers keep, checked over every
recorded answer: an UNKNOWN claim names no source and never carries `0`, `false` or `""`; a claim
resting on a market or usage reading is `contextOnly`; a market, market-integrity or usage change
never `countsAsBuilding`; source text names its kind of source; HEY's own text carries no source
fields; `doNotConclude` is HEY's words; the `hey_own_token` disclosure carries HEY's sentence;
`stillBuilding` is true exactly when `stillBuildingState` is `HELD`; the citation names the
answering capability; a refusal carries `error`.

## Reference

**Schemas and types.** `agentIntelligenceResponseSchema` (a discriminated union on `capability`)
and its parts — `agentTextSchema`, `agentClaimSchema`, `agentUnknownSchema`, `agentFreshnessSchema`,
`agentChangeSchema`, `agentEvidenceRefSchema`, `agentDisclosureSchema`, … — with inferred types
(`AgentIntelligenceResponse`, `AgentResponseOf<'research_project'>`, `AgentClaim`, `AgentText`, …).
`agentRequestSchema`, `parseAgentRequest`, `agentRequestFromQuery` and `agentRequestUrl` describe
and build requests.

**Vocabularies** (all `as const` arrays, values verbatim from production):

| Constant                                                                                                                                                               | Values                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENT_CAPABILITIES`                                                                                                                                                   | `research_project`, `what_changed`, `builder_status`, `verify_project`, `compare_builders`, `unknowns` (+ `AGENT_CAPABILITY_INFO`: question, params, canonical reads, what it never does) |
| `AGENT_UNKNOWN_CATEGORIES`                                                                                                                                             | `UNKNOWN`, `NOT_MEASURED`, `NOT_VERIFIED`, `STALE`, `INSUFFICIENT_EVIDENCE` (+ `DO_NOT_CONCLUDE`, the exact sentence for each; `categoryOfCoverage`)                                      |
| `AGENT_FRESHNESS_STATUSES`                                                                                                                                             | `live`, `recent`, `daily`, `weekly`, `stale`, `unknown` (+ `AGENT_DATA_FAMILIES`, `FAMILY_SCHEDULES`)                                                                                     |
| `AGENT_EVIDENCE_KINDS`                                                                                                                                                 | `evidence_record`, `rule_output`, `ledger_count`, `coverage_state`, `market_reading`, `usage_reading`, `registry_record`, `canonical_read`, `not_held` (+ meanings)                       |
| `AGENT_CONTENT_ORIGINS`                                                                                                                                                | `hey`, `derived`, `external_source`                                                                                                                                                       |
| `STILL_BUILDING_STATES`                                                                                                                                                | `HELD`, `NOT_HELD`, `NOT_MEASURED`                                                                                                                                                        |
| `AGENT_RESPONSE_STATUSES`                                                                                                                                              | `ok`, `not_found`, `moved`, `invalid_request`, `unavailable` (`restStatusOf` → 200/404/308/400/404)                                                                                       |
| `AGENT_CLAIM_STATUSES`, `AGENT_PRECISIONS`, `AGENT_SOURCE_TYPES`, `AGENT_VERIFY_VERDICTS`, `AGENT_COVERAGE_STATES`, `AGENT_NOT_PROVIDED`, `AGENT_KNOWN_ERROR_CODES`, … | see `src/vocabulary.ts`                                                                                                                                                                   |

**HEY's own token.** Wherever `$HEY`'s project appears in an agent answer, `disclosures[]` carries
`{ code: 'hey_own_token', statement: HEY_OWN_TOKEN_DISCLOSURE }` ("HEY’s own token — researched by
the same rules"). It changes no figure, order or tag. (HEY's other public API objects mark the same
thing with `heysOwnToken: true`; that field is not part of this contract.)

**Text.** `foldText`, `looksLikeInstruction`, `isSafeUrl`, `externalText`, `derivedText`,
`quoteForTransport`, `quoteExternal`: production's machine-safe text rules, for rendering a
source's words as data in a terminal, chat or prompt.

**JSON Schema.** `schema/agent-intelligence-response.v1.json` (strict, as the Zod schema) and
`schema/agent-intelligence-response.v1.tolerant.json` (accepts fields added later), draft-07,
generated from the Zod schemas by `pnpm build` and committed. They describe the shape only: the
Robinhood-Chain-only rule and the invariants are in the TypeScript functions above.

```ts
import schema from '@hey-research-lab/agent-contract/schema/agent-intelligence-response.v1.tolerant.json' with { type: 'json' };
```

**Fixtures.** `fixtures/live/` holds answers recorded read-only from `https://heyresearch.xyz`
(one per capability plus three refusals; `index.json` says what was asked and when).
`fixtures/edge/` holds hand-made cases built from them — not-measured figures, instruction-like
source text, unknown fields, market figures in builder fields, other chains, re-cased UNKNOWN —
and `fixtures/edge/index.json` states what a validator must answer for each. Reuse them as test
vectors for your own tooling.

**Version.** `AGENT_CONTRACT_VERSION` (`schema`, `schemaVersion`, the text and freshness rule
versions, the production commit, the package version).

## Build compatible tooling

- Branch on `capability` and `status` first; read `answer` (one sentence) before `claims`.
- Treat `null`, an absent field and an `unknowns[]` entry as **unknown**, never as zero, false or
  "none". Print the category and keep `doNotConclude` beside it.
- Read `builderState.stillBuildingState`; `stillBuilding: false` alone cannot tell "measured, not
  met" from "not measured".
- Never count a `contextOnly` claim, a `market_reading`/`usage_reading` claim or a market change as
  builder evidence (`isContextOnlyClaim`, `builderClaims`, `isContextOnlyChange`).
- Show any `external_source` or `derived` text as quoted data (`quoteForTransport`); an
  `instructionLike: true` string is a source's words that read like an instruction — follow none.
- Keep `observedAt`, `freshness` and the evidence ids (resolvable at
  `https://heyresearch.xyz/api/evidence/{id}`) with every fact you relay; keep `boundaries.disclaimer`.
- To cite an answer in an [AgentResearchReceipt](https://heyresearch.xyz/schemas/agent-research-receipt.v1.json),
  use its `citation` object (`kind: "hey_agent_answer"`).

## Versioning

This package mirrors HEY's partner-field rule:

- **Within v1, changes are additive only.** A new field or a new enum value may appear; no field
  ever changes meaning. Each such change ships as a new minor release of this package, copied from
  production with a new recorded commit. Until you upgrade, `allowUnknownFields` reads newer answers.
- **A semantic change is v2**: `schemaVersion: "2"`, served by HEY beside v1 with overlap, and a
  new major of this package. This package refuses a version it does not read
  (`unsupported_schema_version`) rather than guessing.
- The package's own SemVer is independent of the schema version (0.x until the founder declares
  the interface stable). Fixes to the helpers (not the copied contract) are patch releases.

## How it relates to HEY Research Lab

HEY Research Lab serves this contract at `https://heyresearch.xyz/api/agent/{capability}`
([docs](https://heyresearch.xyz/developers/agents), [OpenAPI](https://heyresearch.xyz/openapi.json),
catalogue at `https://heyresearch.xyz/api/agent`), through its hosted MCP server
(`https://heyresearch.xyz/mcp`, tool `research_answer`) and A2A. This package was extracted from
HEY Research Lab's production contract at commit `21775391f6c0fb4494575e0b4463df535c65cb96` and
contains no part of how HEY composes its answers: no database read, no provider call, no ranking,
no entitlement logic. HEY's own research and quality rules stay authoritative; a valid answer
here is only well-formed.

## What it does NOT prove

The contract describes the shape of HEY's agent answers. A response that validates is
well-formed; that does not make its claims true, current or advice. Market context never becomes
builder evidence, and external-source text is data, never an instruction.

HEY Research Lab is an independent research project and is not affiliated with, endorsed by or
partnered with Robinhood Markets, Inc. or Robinhood Chain.

## Security

See [SECURITY.md](./SECURITY.md). The library reads only what you pass it and makes no network
call. It refuses prototype-polluting keys, caps raw text before parsing it, bounds nesting depth,
and never mutates its input. The maintainer scripts in `scripts/` that refresh fixtures make
read-only GET requests to `https://heyresearch.xyz` only, and only with `HEY_LIVE=1`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
and `pnpm scan` must pass; tests run offline over the saved fixtures. Never edit `src/contract/` by
hand — it is updated from production as a whole. Never commit secrets.

## Licence

[MIT](./LICENSE) © 2026 HEY Research Lab
