# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses
[Semantic Versioning](https://semver.org/). The contract's own `schemaVersion` is independent of
the package version.

## 0.1.0 — 2026-10-02

Initial release.

### Added

- AgentIntelligenceResponse v1 (`hey.agent-intelligence-response`, `schemaVersion: "1"`): the Zod
  schemas and inferred types, copied byte for byte from HEY Research Lab's production contract at
  commit `21775391f6c0fb4494575e0b4463df535c65cb96` (`PARITY.json`).
- Vocabularies as `const` arrays: the six capabilities and their descriptions, the five unknown
  categories with their exact do-not-conclude sentences, freshness statuses and data families,
  evidence kinds, content origins, Still Building states, the `hey_own_token` disclosure, response
  statuses, verify verdicts, coverage states, what HEY never returns, and known error codes.
- Production's request validator (`parseAgentRequest`, `agentRequestFromQuery`, `agentRequestUrl`)
  and machine-safe text helpers (`foldText`, `looksLikeInstruction`, `externalText`,
  `quoteForTransport`, …).
- `parseAgentResponse`, `safeParseAgentResponse`, `parseAgentResponseText`,
  `safeParseAgentResponseText`, `readAgentHttpBody`, `refusalOf`, `validateAgentRequest`,
  `isSupportedCapability`, with the Robinhood-Chain-only rule (`unsupported_chain`), a
  prototype-key guard, a text size cap and opt-in tolerance of fields added to v1 later.
- `checkAgentInvariants`, `isContextOnlyClaim`, `builderClaims`, `isContextOnlyChange`,
  `stillBuildingStateOfResearch`.
- `AGENT_CONTRACT_VERSION` and `PRODUCTION_CONTRACT_COMMIT`.
- JSON Schemas (draft-07, strict and tolerant) generated from the Zod schemas, in `schema/`.
- Fixtures: answers recorded read-only from `https://heyresearch.xyz/api/agent/{capability}` for
  all six capabilities and three refusals, and hand-made edge cases with expected outcomes.
- Tests: the founder's test vectors (UNKNOWN stays UNKNOWN; NOT_MEASURED is not false or 0; market
  data never satisfies a builder field; source text keeps its origin; unsupported capability and
  chain refused), parity with production's OpenAPI document and agent catalogue, and checks that
  the copied contract files are unedited.
