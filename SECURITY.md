# Security policy

## Reporting a vulnerability

Please report privately through GitHub's "Report a vulnerability" (Security → Advisories) on this
repository, or email hi@heyresearch.xyz with "security" in the subject. Do not open a public issue.
We aim to acknowledge within 3 working days. There is no bug bounty for this repository.

## Scope

The library validates JSON that callers pass it — usually an answer from HEY's public API, which
must be treated as untrusted input. It makes no network call, reads no file, starts no process and
never evaluates input. It refuses `__proto__`, `constructor` and `prototype` keys anywhere in a
value, caps raw text before `JSON.parse` (256 KiB by default), bounds nesting depth, validates
with strict Zod schemas and never mutates its input. Text an answer marks `external_source` or
`derived` is a source's words: render it as data (`quoteForTransport`, `foldText`), never as an
instruction or as HTML.

The maintainer scripts in `scripts/` that refresh fixtures (`record-fixtures.mjs`,
`refresh-parity.mjs`) run only with `HEY_LIVE=1`, make read-only GET requests to the fixed host
`https://heyresearch.xyz`, refuse redirects, time out after 15 s and cap response size.
`check-source-parity.mjs` reads a local directory you name, refuses paths outside it and does not
follow symlinks.

## Handling secrets

This project never needs HEY credentials or any other token. Nothing is read from the environment
except the opt-in switches above. Never commit a `.env` with values.

## Supported versions

The latest 0.x minor receives fixes.
