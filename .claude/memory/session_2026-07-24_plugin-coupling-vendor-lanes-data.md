---
name: Plugin coupling fixed - vendored sidecoach-lanes.json with build-time drift gate
description: Closed the biggest self-contained-plugin blocker (decision 2). Vendored claude/hooks/sidecoach-lanes.json into sidecoach/data/, repointed the runtime /sidecoach <phrase> read to the package-local copy, and added a byte-exact generator with a fail-fast --check drift gate wired into npm run build. Behaviour-preserving relocation; no lane resolution changed.
type: project
relates_to: [decision_2026-07-24_vocab-collapse-and-plugin-coupling.md, session_2026-07-24_distributability-plugin-manifest-package-metadata.md, session_2026-07-24_stage4b-groundb-live-wiring.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (76 suites) + build drift-gate + monitor sibling-absent E2E + codex-review
confidence: high
---

Collaborator: Jonah. 2026-07-24. Implements decision 2 (vendor with build-time sync) from decision_2026-07-24_vocab-collapse-and-plugin-coupling.md. Authored against HEAD d2fca78d.

## What was blocking self-containment
The `/sidecoach <phrase>` runtime path resolved `path.resolve(__dirname, '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json')` in `sidecoach-orchestrator.ts` - a repo SIBLING outside the package. `npm pack` (files allowlist [dist,bin,data,reference]) cannot ship a repo sibling, so an installed plugin had no lane registry and the read threw ENOENT. This was the coupling flagged (correctly, out-of-scope) by the distributability beat.

## What was done
- **Vendored** `sidecoach/data/sidecoach-lanes.json` - a byte-exact copy of the canonical `claude/hooks/sidecoach-lanes.json` (data/ already in the npm files allowlist). Generated output, committed like dist/ (tracked-output pattern).
- **Repointed** the orchestrator read (the ONLY line touched in that 1000+ line file) to `path.resolve(__dirname, '..', 'data', 'sidecoach-lanes.json')`. `__dirname` is dist/ when built and src/ under ts-node - both one level under the package root, so '..','data' lands on sidecoach/data either way. The Ground B audit-call region was NOT touched.
- **Generator** `sidecoach/scripts/generate-lanes-data.ts` - reads canonical, writes data/ as a raw Buffer (no parse/re-stringify, so `diff` shows nothing). `--check` compares bytes and fails on drift. Fail-loud distinct exit codes: 2 = canonical source missing, 3 = drift.
- **Build wiring** in package.json: `npm run build` runs `generate-lanes-data.ts --check` (fail-fast gate) between generate-lanes and generate-validators; added `npm run generate-lanes-data` convenience script for on-demand regeneration.

**Why (design):** self-contained AND single-source-of-truth. Canonical stays `claude/hooks/`; the package copy is generated + committed; the build gate catches drift.

**How (the drift-gate decision - diverges from a literal "mirror generate-validators"):** The spec said wire it "the same way generate-validators --check gates drift." Codex found (Medium) that the literal validators pattern `generate && generate --check` does NOT fail on drift - the generate step silently overwrites the stale copy before the check, so the check trivially passes; drift is only caught by an external CI dirty-worktree check, and this repo has none (.github has only Claude review workflows). The spec's load-bearing functional requirement is explicit: the --check "fails if the vendored copy is stale ... npm run build runs it." So the build runs `generate-lanes-data.ts --check` ONLY (fail-fast), with generation on-demand via `npm run generate-lanes-data`. Justified asymmetry vs validators: validators.generated.ts is a compiled build INPUT (tsc needs it fresh, so regenerate-in-build), whereas data/ is a committed, shipped RUNTIME artifact (read at runtime), so the build's job is to GATE staleness, not self-heal it. Result: `npm run build` now exits 3 on canonical drift and stops before tsc - strictly stronger than the spec's standalone-check ask.

## Verification (all real output)
1. Byte-identity: `diff data/sidecoach-lanes.json ../claude/hooks/sidecoach-lanes.json` empty; both SHA-256 9526400ea62d...1eac24b6.
2. Drift gate: in-sync `npm run build` exit 0 ("generate-lanes-data --check: OK"); append a byte to canonical -> `npm run build` exit 3 at the data --check ("DRIFT ...") before tsc; restore -> exit 0. Standalone --check also exits 3 on drift.
3. Sibling-absent E2E via compiled monitor (`node bin/sidecoach-monitor.js "/sidecoach declutter this dashboard"`): with both present -> resolves lane_calm; sibling claude/hooks/sidecoach-lanes.json renamed away -> STILL resolves lane_calm (no longer depends on the sibling); vendored data/ renamed away (sibling present) -> throws ENOENT at `.../sidecoach/data/sidecoach-lanes.json` with stack FlowExecutionEngine.process (dist/sidecoach-orchestrator.js:997) -> loadRegistry -> proving the orchestrator reads the package-local copy. Both files restored byte-exact.
4. `npm test`: run-tests 76 suite(s) passed (baseline held; re-confirmed after the build-script change).
5. `npm pack --dry-run` includes `7.0kB data/sidecoach-lanes.json` - the plugin now ships its lane registry.

## Codex review
Deterministic wrapper (git diff HEAD | ~/.claude/hooks/codex-review.py ... -C sidecoach), exit 0, 97.6s. One Medium finding (build ordering neutralized the drift gate) - FOLDED by switching the build to check-only fail-fast (see the drift-gate decision above) and re-verified (build now exits 3 on drift). Confirmed: runtime path correct from src/ and dist/; no lane resolution behaviour change; generator exit codes/Buffer compare sound.

## Next coupling target (NOT fixed - out of scope, flagged)
Grepping the shipped dist for repo-sibling escapes (`'..', '..'`) surfaces three dogfood/demo drivers that still escape the package: `dist/dogfood-craft-step2.js` and `dist/dogfood-teach-step1.js` (both -> `../../marketing-site`) and `dist/dogfood-runner.js` (-> `../..` repo root). They ship in dist/ (files allowlist) but are dev harness scripts, not on the `/sidecoach` runtime path. Next step: exclude them from the shipped dist or guard/repoint their paths. The runtime lane read no longer escapes.

## Files touched
- sidecoach/scripts/generate-lanes-data.ts (new - generator + --check)
- sidecoach/data/sidecoach-lanes.json (new - vendored/generated, committed)
- sidecoach/src/sidecoach-orchestrator.ts (1-line read repoint + rationale comment)
- sidecoach/package.json (build gate wiring + generate-lanes-data script)
- sidecoach/dist/ (rebuild artifacts: sidecoach-orchestrator.js + .d.ts.map + .js.map)
Not committed (per task).
