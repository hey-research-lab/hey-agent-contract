# Contributing

Thank you for helping. This package is the public description of HEY Research Lab's agent answers,
so its first rule is fidelity: it says exactly what production sends, no more.

## Setup and checks

```sh
corepack enable
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm scan            # leak and attribution scan; CI runs it too
pnpm format:check
```

Node 22 is used for development and CI; the published library supports Node 18 or newer. Tests
never touch the network (`vitest.setup.ts` replaces `fetch` with one that throws); they run over
the saved fixtures. Never commit secrets or a `.env` with values.

## Layout

| Path                       | What                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/contract/`            | Byte-for-byte copies of the pure modules of HEY's production contract. **Never edit by hand.**                                    |
| `src/contract/excerpts.ts` | Pure constants and functions production keeps beside its composers and adapters, copied verbatim between `// <verbatim>` markers. |
| `src/*.ts`                 | This package's own additions: vocabulary arrays, validation, invariants, chain rule, version.                                     |
| `PARITY.json`              | The production commit and the SHA-256 of every copied file and excerpt.                                                           |
| `schema/`                  | JSON Schemas generated from the Zod schemas by `pnpm build`. Committed; do not edit.                                              |
| `fixtures/live/`           | Answers recorded from the live API.                                                                                               |
| `fixtures/edge/`           | Hand-made cases, built by `pnpm fixtures:edge` from the live answers.                                                             |
| `fixtures/parity/`         | Production's published description of the contract (OpenAPI agent parts, `/api/agent`).                                           |

## Parity with production

`src/contract/` matches HEY Research Lab's production contract as of 2026-10-09 (0.1.0 matched
2026-10-02). It is copied from the public mirror
[hey-research-open](https://github.com/hey-research-lab/hey-research-open), commit recorded in
`PARITY.json`: the zod-only modules `capabilities.ts`, `schema.ts`,
`evidence-kinds.ts`, `freshness.ts`, `unknowns.ts`, `text.ts`, `disclosures.ts`, `words.ts`,
`records.ts` and `request.ts` of `packages/agent-provider-core/src` (the same package is
published in [hey-research-open](https://github.com/hey-research-lab/hey-research-open)), plus five
excerpts (`AGENT_NOT_PROVIDED`, `isContextChange`, `ADAPTER_REQUIRED_FIELDS`, `restStatusOf`,
`HEY_EVIDENCE_FAMILIES` with `evidenceFamiliesFor` and `looksLikeEvidenceId`). The
composers, transport adapters, benchmark, database loaders, compare loader, entitlement and
analytics code are deliberately not copied.

Three checks hold the copy to production:

1. `test/contract-copy.test.ts` (in CI): every copied file and excerpt still has the hash in
   `PARITY.json`.
2. `test/parity.test.ts` (in CI): the schema's enums, required fields and limits equal production's
   published OpenAPI document and agent catalogue, saved in `fixtures/parity/`.
3. `pnpm parity:source` (by hand, with a checkout): byte equality with the source itself.

```sh
HEY_CONTRACT_SOURCE=../hey-research-open/packages/agent-provider-core/src pnpm parity:source
```

### Refreshing the parity snapshot and fixtures

These make a few read-only GET requests to `https://heyresearch.xyz`, paced at no more than one a
second. Never in CI.

```sh
HEY_LIVE=1 pnpm parity:refresh          # fixtures/parity/: OpenAPI agent parts + /api/agent
HEY_LIVE=1 pnpm fixtures:record         # fixtures/live/: one answer per capability + refusals
HEY_LIVE=1 pnpm fixtures:record compare_builders   # only the named ones
pnpm fixtures:edge                      # rebuild fixtures/edge/ from the live answers
pnpm test
```

Review the diff: recorded answers carry project names, release titles and figures as of the day
they were recorded. A parity failure after a refresh means production's contract moved.

### Updating from production

```sh
HEY_CONTRACT_SOURCE=<dir> HEY_CONTRACT_COMMIT=<sha> node scripts/check-source-parity.mjs --update
```

copies the files again and records the commit; update the excerpt blocks by hand if they moved,
update `PRODUCTION_CONTRACT_COMMIT` in `src/version.ts`, run `pnpm build` (regenerates `schema/`),
refresh the parity snapshot and fixtures, and add a CHANGELOG entry. An additive change is a minor
release; a change of meaning is a new `schemaVersion` and a new major (README, "Versioning").

## Pull requests

Small, focused changes with tests. Conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`,
`chore:`, `ci:`). Product rules apply to every word: no trading language, no safety verdicts, and
unknown is never zero.
