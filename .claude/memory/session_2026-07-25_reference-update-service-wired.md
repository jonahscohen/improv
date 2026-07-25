---
name: reference-update-service made REAL + wired behind bin/sidecoach-refs.js
description: Rewrote the built-never-wired reference-update-service into a real two-location merge-preserving updater with a bin CLI; folded 4 Codex findings
type: project
relates_to: [session_2026-07-24_simplification-phase2-deadcode.md, session_2026-07-25_flow-domain-deleted-lead.md, session_2026-07-25_taste-skill-repo-inventory.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: Mac
source: session
verified: tests + cli-proofs + foreground-codex
confidence: high
---

Executes Jonah's ruling to KEEP `src/reference-update-service.ts` (one of the three built-never-wired
candidates the Phase 2 dead-code pass surfaced) and MAKE IT REAL + SENSIBLE, not delete it. Authored
against HEAD ba704fb3.

**Sensible scope chosen (two-location install model):**
- `upstream` = the canonical bundles that ship in the repo (`sidecoach/bundles/*.json`, resolved
  `../bundles` from the module). Read-only source of truth, versioned via `metadata.version` +
  `versions.changelog`.
- `local` = a user-owned writable copy (default `~/.claude/sidecoach/reference-bundles/`). This is the
  artifact that carries the user's merged captures forward across refreshes.
- `captures` = the REAL `/curate` catalog `~/.claude/design-references/<slug>/ref.md` (the same one
  `reference-data.ts loadDesignReferences()` reads). Folded into the design-references bundle's
  `userCaptured` map on apply. The live catalog on disk (2 real captures) was detected end-to-end.

**What was pruned (speculative/dead in the 337L original):** `versionCacheFile` (`.version-cache.json`,
set in ctor, never read); the `upstreamURL` network-fetch stub ("would fetch from upstream in
production" - no network is wanted); `loadUserCaptures` reading a FICTIONAL `./user-captured/<date>/*.json`
model that never matched how `/curate` stores captures; the `checkBundleUpdate` stub that always returned
`updateAvailable:false`. Also dropped the fake `async` (there is zero network/await) - check/apply are now
honestly synchronous.

**Why this beats "oracle" (the hosted competitor catalog):** oracle's references are a hosted catalog you
cannot own or refresh locally. OURS is local, user-owned, and the update is UNION-PRESERVING - captures
already in the local copy AND captures scanned from the curate catalog BOTH survive an upstream refresh
(catalog wins a slug conflict as the fresher source). A user capture is never clobbered by an upstream
that has none. The check is a fast pure-read (version + content-hash), no polling, no daemon.

**How (mechanics):**
- `check()` pure read: per system compares local vs upstream by `metadata.version` AND a sorted-key
  sha256 content hash that EXCLUDES the local-only `userCaptured` map - so it distinguishes "newer
  upstream version" (reason `version`) from "same version, drifted content" (reason `content`). Reports
  captures that would be preserved. Never writes.
- `apply()` fail-closed + atomic PER system: build merged bundle in memory -> validate (metadata +
  per-system required keys) -> short-circuit if byte-identical -> write to `.<name>.json.tmp-<pid>-<rand>`
  then `renameSync` into place. Any upstream read/parse failure, a corrupt local (refused - see below), a
  validation failure, or a write failure leaves the local file BYTE-UNCHANGED, no temp file left.
- DESIGN.md stamp: idempotent HTML-comment-bracketed block (`<!-- sidecoach:reference-bundles:start/end -->`)
  with a version table. Uses a bold label + table, NOT a `##` heading, so it does not add a section to a
  Google-spec DESIGN.md body. Only touches an existing DESIGN.md; never creates it.

**Deliverable:** `bin/sidecoach-refs.js` - thin CLI over the service. Loader prefers fresh TS via
ts-node (dev), falls back to compiled dist (installed), with an export-sanity guard so a stale-API dist
fails loud (70) instead of crashing. Distinct exit codes: 0 ok, 2 usage, 3 upstream, 4 validation, 5 io,
10 drift (--check), 70 internal. Flags: --check (default, dry-run), --apply, --all, --systems,
--upstream/--local/--captures/--design-md, --no-design-md, --json, --quiet.

**Foreground Codex review (codex-cli 0.142.5, blocking) - 4 findings, ALL folded + regression-tested:**
1. HIGH: default `--apply` dropped `error`-status systems from targets -> a broken upstream could exit 0.
   Fix: include `error` systems so they surface as a failed apply (exit 3). (Test 8.)
2. HIGH: a corrupt-but-present local bundle was blindly overwritten -> local-only captures lost. Fix:
   REFUSE to overwrite an unparseable local (fail closed, io error, byte-unchanged). (Test 9.)
3. MED: DESIGN.md read/write failure was swallowed (still exit 0). Fix: `DesignMdUpdate.failed` flag; CLI
   maps a real stamp failure to exit 5.
4. MED: dist fallback + `getPaths()` outside the try could crash to exit 1 not 70. Fix: export-sanity
   guard in the loader + construction moved inside the try.

**Verify (all real output captured this session):** `npx tsc --noEmit` exit 0; standalone test
`src/__tests__/reference-update-service.test.ts` 9/9 groups PASS via ts-node; `--check` on real bundles
proven byte-for-byte non-mutating (before/after shasum identical, no local dir, no temp files), exit 10
drift; CLI fixture apply MERGES + preserves a planted capture across a 1.0.0->2.0.0 refresh (both a
catalog capture and a legacy local-only capture survive); fail-closed proven at CLI for validation (exit
4) and upstream (exit 3) with local byte-unchanged + zero temp files; default `--apply` with broken
upstream now exits 3 (Fix 1).

**Notes for integration (Jonah owns):**
- run-tests.ts suite line to ADD (I did not edit run-tests.ts):
  `{ rel: 'src/__tests__/reference-update-service.test.ts', required: true },`
- dist NOT rebuilt/committed (Jonah does at integration). Not committed.
- The service went 337 -> 649 lines: a near-full rewrite (+572/-260). NOT bloat - every symbol is
  exercised by the test or CLI proofs; the growth is real capability (hashing, atomic writes, fail-closed
  classes, union merge, DESIGN.md stamp) replacing stubs, plus house-style doc headers.
- `bin/sidecoach-drift.js` appeared untracked during the session - it is a PARALLEL teammate's file
  (project-drift-detector), not mine; left untouched.
- File ownership honored: only reference-update-service.ts, bin/sidecoach-refs.js, and the new test were
  written. reference-data.ts / reference/ read only; scanner/orchestrator/router/audit-rendered and the
  other two wire-up targets untouched.

Files touched: src/reference-update-service.ts (rewrite), bin/sidecoach-refs.js (new),
src/__tests__/reference-update-service.test.ts (new).
