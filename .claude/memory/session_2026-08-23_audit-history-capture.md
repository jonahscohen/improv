---
name: Audit-history capture - append-only detect fire-log for the taste miner
description: Every sidecoach-detect scan now appends a compact JSONL line (utc, target, verdict, findings[rule,severity,lens], counts) to sidecoach/data/audit-history.jsonl. Wired at the single choke point in bin/sidecoach-detect.js so BOTH the CLI and the taste-gate hook capture. Best-effort, fail-open, append-only, stdout contract untouched.
type: project
relates_to: [session_2026-08-23_self-updating-taste-pipeline-design.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + curl-style CLI/hook e2e
confidence: high
---

# Audit-history capture (built)

Collaborator: Jonah. Executor unit handed by team-lead. Implements the "INTERNAL-B audit history"
input from the self-updating taste pipeline design (session_2026-08-23_self-updating-taste-pipeline-design.md):
every `sidecoach-detect` scan already builds a result JSON and drops it after stdout; the recurring-defect
miner needs that fire-data to accrue. This persists it.

## What was built
- NEW `sidecoach/bin/audit-history.js` - stdlib-only capture module. `captureScan(result, opts)` appends
  ONE JSONL line per scan; `buildEntry`/`summarizeFindings` are pure + total (unit-testable, never throw).
  Line shape (v1): `{v, utc, target, targetKind, verdict, counts:{blocking,warning,info}, findings:[{rule,severity,lens}]}`.
  Findings are REDUCED to the (rule, severity, lens) fire-rate triple - heavy detail/selector/remediation
  stay only in the transient stdout JSON.
- WIRING: one fail-open block in `bin/sidecoach-detect.js` main(), AFTER the stdout write + printSummary,
  BEFORE process.exit: `try { require('./audit-history').captureScan(result); } catch (_e) {}`.
- `sidecoach/.gitignore` (was empty) ignores `data/audit-history.jsonl` and its `.1` rotation sidecar.
- TEST `src/__tests__/audit-history.test.ts` registered in `scripts/run-tests.ts` (required), next to detect-cli.

## Wiring choice + rationale (Why)
Captured in `bin/sidecoach-detect.js`, NOT in the taste-gate hook. The hook shells out to `node sidecoach-detect.js`,
so the detect binary is the single choke point BOTH the CLI path and the hook path pass through - capturing there
captures both with one insertion, and any future consumer of detect captures for free. Capturing in the hook would
miss every direct CLI/`sidecoach audit`/other-consumer scan. Placed after stdout so a capture that somehow blocked
could never delay the machine contract the hook reads.

## Hard constraints held (How, and how proven)
- STDOUT CONTRACT UNTOUCHED: capture writes to a FILE only, never stdout. Proved byte-identical: same `--no-render`
  scan with capture ON vs OFF (`SIDECOACH_NO_AUDIT_HISTORY=1`) -> `diff`/`cmp` report zero difference.
- APPEND-ONLY: `fs.appendFileSync` with O_APPEND; two scans -> two lines (test + live).
- FAIL-OPEN / BEST-EFFORT: the whole body is a try/catch returning false; the require+call in detect is itself
  wrapped. Forced failure (log path whose parent is a FILE) -> detect still exits with the normal verdict code,
  stdout still carries the full result JSON, no traceback, bad path not created. Proved at module level AND e2e.
- BOUNDED GROWTH: size guard rolls the log to a single `.1` sidecar at SIDECOACH_AUDIT_HISTORY_MAX_BYTES
  (default 5 MiB). One generation retained; a miner wanting the full window reads the live file + the `.1`.
- Env knobs (call-time): SIDECOACH_AUDIT_HISTORY (path), SIDECOACH_NO_AUDIT_HISTORY (disable),
  SIDECOACH_AUDIT_HISTORY_MAX_BYTES (rotation), SIDECOACH_AUDIT_DEBUG (one stderr line on failure, off by default).

## Verification run
- `npx ts-node src/__tests__/audit-history.test.ts` -> `audit-history: OK` (9 groups: shape, total-on-junk,
  append-only, fail-open, disable, rotation, e2e stdout parity, e2e capture, e2e fail-open).
- `npx ts-node scripts/run-tests.ts --only audit-history` -> `1 suite(s) passed` (real runner + failure-verdict scan).
- `npx ts-node scripts/run-tests.ts --only detect-cli` -> `detect-cli: OK` (real browser e2e; my edit didn't perturb detect).
- `npx tsc --noEmit` clean.
- taste-gate hook driven with a synthetic Write payload on a temp DESIGN.md project -> emits its TASTE GATE JSON
  AND its detect subprocess appended a capture line (shared choke point confirmed live).

## Cross-model review (Codex, gate satisfied)
- PASS 1 (real Codex, 66s): 3 real defects, ALL folded + re-verified green -
  (1) High: rotation `rename` could clobber the `.1` sidecar and race under concurrent CLI+hook writers
      -> added a best-effort mkdir mutex around rotation with a size RE-CHECK under the lock (a freshly-rotated
      small live is never rolled over `.1`) + a 60s stale-lock steal so rotation can't wedge.
  (2) Med: buildEntry/summarizeFindings not total on hostile input (Symbol counts / throwing getters)
      -> guarded every field read via safeStrProp/safeNumProp; the "records the scan happened" claim is now true.
  (3) Med: same rotation race -> covered by (1).
- PASS 2 (confirming, 149s): all 3 prior findings resolved; reconfirmed NO path where capture throws out of
  detect and NO stdout/exit-code perturbation. Surfaced ONE new narrow Med: a hostile findings ITERATOR
  (a Proxy array whose Symbol.iterator throws - Array.isArray sees through the Proxy) could still make
  summarizeFindings throw. Cannot occur with detect's real result (findings is always a plain Array from
  .filter().map()), and captureScan stays fail-open regardless, but the module advertises totality -> folded:
  the for-of loop in summarizeFindings is now try/caught (returns what was collected). Test added (Proxy
  iterator -> buildEntry does not throw, capture still records a line). Re-verified green.

## Self-analysis / baseline note (Team Rule 9)
- PRE-EXISTING BUILD BREAK, not mine: `npm run build` fails at `generate-tool-index` because an UNTRACKED
  `sidecoach/bin/sidecoach-taste-ingest.js` (created 16:22 today by a parallel worker) has no DESCRIPTIONS entry.
  My `audit-history.js` is deliberately NOT swept by that generator (its filter is `/^sidecoach.*\.(js|mjs|sh)$/`
  and my file lacks the `sidecoach` prefix), so it adds no build break. `npm test` (build-first) is blocked by the
  taste-ingest file until its owner registers it; I verified my unit via direct tsc + scoped ts-node runner instead.
  Flagged to the lead - it is the taste-ingest owner's to fix, I did not touch another worker's WIP.

## Files touched
- NEW: sidecoach/bin/audit-history.js
- NEW: sidecoach/src/__tests__/audit-history.test.ts
- NEW: sidecoach/.gitignore
- EDIT: sidecoach/bin/sidecoach-detect.js (one fail-open capture block near end of main())
- EDIT: sidecoach/scripts/run-tests.ts (one SUITES registration line)
