---
name: sidecoach eval harness wired into npm test + build-before-test
description: The 5 eval/migration-harness golden snapshots now run in the default gate, and npm test builds first so a src regression cannot pass on stale dist
type: project
relates_to: [session_2026-07-17_sidecoach-audit-342-false-alarm.md]
supersedes: 
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (71/71 pass exit 0; two negative tests both caught; real Codex review folded)
confidence: high
---

Follow-up to the 09d19d55 audit, which found that `absolute-ban-detector.ts` and
`reference-loader.ts` have NO unit tests and their only coverage
(`eval/migration-harness/*-snapshot.mjs`) was never run by `npm test`. Jonah chose to
wire the harness into the gate.

## What changed

`sidecoach/scripts/run-tests.ts`
- `Suite` interface gained optional `runner?: 'ts-node' | 'node'` and `args?: string[]`.
- Execution loop branches: `runner === 'node'` -> `execFileSync('node', [full, ...args])`,
  else the existing `npx ts-node` path.
- Added 5 required suites: scanner / reference / routing / convergence / buildreport
  snapshots, each with `args: ['verify']`. Suite count 66 -> 71.

`sidecoach/package.json`
- `test` is now `npm run build && ts-node scripts/run-tests.ts` (was just the runner).

## Why build-before-test (the Codex finding)

**Why:** the harnesses import from `dist/`, NOT `src/`. `npm test` did not build. So a
regression in `src/absolute-ban-detector.ts` would be checked against a STALE `dist` and
pass green - voiding the entire point of wiring them in. I had originally papered over
this with a code comment; real Codex review (via `~/.claude/hooks/codex-review.py`)
correctly called the comment insufficient because it does not deliver the stated guarantee.

**How:** `npm run build` is only ~5s against a multi-minute suite, so building first is
cheap and robust. Rejected the alternative (an mtime-based src-vs-dist staleness check)
because git checkout/clone sets arbitrary mtimes, which would produce false failures on
fresh clones.

## Proof (two negative tests, not just a green run)

1. Corrupted `golden/scanner/absolute-bans.json` -> `scanner goldens DRIFT` + exit 1.
   Proves failure propagates through the new `node` branch to a nonzero exit.
2. The decisive one for the Codex finding: regressed `src/absolute-ban-detector.ts`
   (line 162 gradient-text `'P1'` -> `'P2'`) and did NOT rebuild, leaving dist stale.
   - OLD behavior (`npx ts-node scripts/run-tests.ts`, no build): **exit 0, "VERIFY OK"**
     - the real regression was MISSED. Codex was right.
   - NEW behavior (`npm test`, builds first): **exit 1, "scanner goldens DRIFT"** - CAUGHT.
   Both sabotages reverted; `git status` shows zero dist drift; final run 71/71 exit 0.

## Self-analysis

I spotted the dist-vs-src staleness trap myself and then chose to only DOCUMENT it rather
than fix it. That was the failure: a comment describing a hole is not a gate. The tell was
that I wrote a guarantee ("the ONLY coverage for these modules") in the same comment block
where I admitted the guarantee could be void - two sentences that contradict each other
should have forced the fix at write time. The review gate caught what I had rationalized.
Lesson: when a caveat you are writing would falsify the claim directly above it, that is a
defect, not documentation.

Also of note: `codex:codex-rescue` is BLOCKED by hook for REVIEW intent (it can silently
downgrade to same-model self-review). The deterministic wrapper
`git diff <f> | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo>` is the required path
and worked (real verdict in 76s, exit 0).

## Still open

`absolute-ban-detector.ts` and `reference-loader.ts` still have no UNIT tests - they now
have golden-snapshot coverage in the gate, which catches behavior drift but not
edge-case-level spec correctness. Backfilling real unit tests remains the open follow-up.

## Files touched

- sidecoach/scripts/run-tests.ts
- sidecoach/package.json
