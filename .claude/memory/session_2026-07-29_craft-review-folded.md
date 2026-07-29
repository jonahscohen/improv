---
name: Cross-model review of the craft wiring - four findings folded, one of them a false clean bill
description: Codex review of craft-probe/corpus/flow/floor found a check flow reporting an unmeasured domain as passing, plus a permanently-poisonable probe cache and two hook defects
type: feedback
relates_to: [session_2026-07-29_craft-corpus-across-verbs.md]
author_human: Jonah
author_model: claude-opus-4.6
machine: spare3
source: session
verified: codex-review + regression tests for every folded finding
confidence: high
---

# Cross-model review of the craft wiring

Real Codex verdict in 311.8s via `git diff | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo>`.

The `codex:codex-rescue` agent was BLOCKED for review intent by a guard hook, correctly: it silently
downgrades to a same-model self-review when codex is slow (precedent
session_2026-06-30_codex-rescue-silent-downgrade). The deterministic wrapper either runs real Codex or
fails loudly. Worth remembering - reach for the wrapper for review, the agent for rescue.

Critical: none. High: 1. Medium: 3. Low: 1. All folded, each with a regression test.

## HIGH - a check flow reported an unmeasured domain as passing

`craft-flow.ts` classified a check flow as `clean` whenever `failed.length === 0`. But the probe is
STATIC SOURCE ONLY: contrast, hit-area and every rendered rule return `inconclusive` without a live
render. So an accessibility check over a clean-looking page emitted

> nothing to teach - every checked rule in this domain passed on this project

about six rules it had never evaluated. That is the exact defect the probe's own `measured` flag was
built to prevent, defeated one layer up by the message that overrode it.

This one stings because the beat I had just written claimed "an unmeasured project is never presented
as clean" as a verified property. It was verified for the empty-directory case (`measured: false`) and
NOT for the far more common case: a project with real source where the rules in scope happen to need a
renderer. I tested the boundary I had thought about and not the one that actually fires.

Fix: `inconclusive` is now a distinct mode. `clean` requires every in-scope rule to have been DECIDED.
The payload now reads:

> nothing to teach - no rule in this domain FAILED. This is not a clean bill: 6 rules could not be
> decided from static source and were not evaluated (a11y/broken-image, a11y/color-contrast, ...).
> Those need a live render - run the audit against a served URL to decide them.

Every scope helper in `craft-probe.ts` now comes in pairs (`failedInClasses` /
`inconclusiveInClasses`), because a caller that can only ask "what failed?" cannot tell an
all-passed domain from an unevaluated one and will report the second as the first.

## MEDIUM - the probe cache could be poisoned permanently

A check returning `undefined` (or any shape without `status`) threw OUTSIDE the per-check try, so
`verdict.status` blew up, the rejected promise was stored in the cache, and every later probe of that
path awaited the same rejection forever. One malformed verdict = a permanently broken guidance path.

Fix: the verdict SHAPE is validated inside the try (a check is external code from this module's point
of view), every field is defensively read, the whole async body is `.catch`-wrapped, and a rejection
EVICTS its own cache entry so the next probe retries.

## MEDIUM - stale results and an ignored cache input

The cache was keyed on the resolved path alone and held for the process lifetime, so a long-lived
process could replay a stale CLEAN result after the project changed. `opts.designTokens` was also
absent from the key, so the first call's tokens were silently reused for every later call on that path.

Fix: `CRAFT_PROBE_TTL_MS = 30_000` (a flow chain runs in seconds, which is the case the cache exists
for) and the key now includes a sorted designTokens fingerprint. An unserialisable token object gets a
deliberately unrepeatable key - disabling caching for that call is correct; returning another call's
result is not.

## MEDIUM - the floor skipped a new session's first UI edit

The cooldown state was keyed per project and persisted, not per session, contradicting the file's own
comment that the first UI write in a session always gets the floor. A fresh session starting within
900s of a previous session's write silently skipped the single most important injection there is.

Fix: the session id is part of the state key, sanitised to `[A-Za-z0-9_-]` and truncated to 16 chars so
it cannot escape the state dir. Regression-tested including a traversal-shaped session id.

## LOW - the hook leaked stderr when the state dir was unwritable

`printf '%s' "$NOW" > "$STATE_FILE" 2>/dev/null` sets up the stdout redirection BEFORE the stderr one,
so an unwritable state dir leaked the redirection error anyway - a hook that works while printing an
error on every UI write, which is precisely how the bash-3.2 bug hid earlier the same day. Fixed by
redirecting the whole group: `{ printf '%s' "$NOW" > "$STATE_FILE"; } 2>/dev/null || true`.

## What Codex checked and cleared

- Inconclusive rules are never built into `failed` (the list is filtered on `status === 'fail'`).
- The deliberate `craft-corpus` <-> `craft-laws` cycle is runtime-safe: craft-laws uses `import type`,
  so nothing is emitted back into craft-corpus, and the lazy `require` resolves normally.
- `craftP` / `craftQ` in `flow-handlers-tier3-tier4.ts` are declared before their returns and outside
  conditional branches. No use-before-declaration.

## Self-analysis

Why did the High finding happen? Because I wrote the honesty guarantee as a scope LINE - a sentence
appended below the brief naming the inconclusive count - and then wrote a separate headline message
that contradicted it. Two places stating the same property, and only one of them got the logic. The
scope line was correct the whole time; the headline overrode it in the reader's eye.

The general lesson: when a payload makes a CLAIM (this is clean), the claim and the data behind it must
come from one computation, not from two sentences assembled independently. The scope line and the
headline now both derive from `mode`.

## Also caught during the fold, by the invariant rather than by review

`registryCraftGaps()` failed on `anti-pattern/overused-font`, `anti-pattern/single-font` and
`anti-pattern/bounce-easing` - three rules a CONCURRENT change added to the registry while this work
was in flight. That is the coverage invariant doing its job: a rule reaching the registry without
teaching content fails a test instead of reaching a payload as a bare defect name. Notes written from
`src/validators/checks/typography-motion-tells.ts`, including the real replacement curves
(`cubic-bezier(0.23, 1, 0.32, 1)` confident, `cubic-bezier(0, 0, 0.2, 1)` softer) rather than "avoid
bounce".

Separately: `npm test` failed once mid-fold on `run-validator.ts: Cannot find name
'ProductValidatorDeps'` - a teammate's in-flight rename, modified 11 seconds before I looked, with the
symbol declared nowhere. Not mine (my modules reference `run-validator` zero times) and it cleared on
its own. Recorded because a shared working tree makes another agent's half-landed edit look exactly
like your own regression, and the cheap discriminator is `git diff --name-only` plus the file mtime.

## Files touched

`src/craft-probe.ts` (inconclusive scope helpers, TTL + token-aware cache key, verdict-shape
validation, rejection eviction), `src/craft-flow.ts` (`inconclusive` mode, `undecided` on the result,
honest headline), `src/craft-corpus.ts` (3 notes for the newly-added registry rules),
`claude/hooks/sidecoach-craft-floor.sh` (session-scoped state key, grouped redirection),
`src/__tests__/craft-corpus.test.ts` and `claude/hooks/test-sidecoach-craft-floor.sh` (regression
coverage for all five findings).
