---
name: Sidecoach Stage 3a - unified detect CLI (bin/sidecoach-detect.js)
description: ONE fail-closed detect command dispatching URL/dir/file targets to the rendered scanners, static ban scanners, and product rule registry; replaces the deleted fake detect
type: project
relates_to: [session_2026-07-23_sidecoach-upgrade-plan.md, session_2026-07-16_honesty-defect-fixes.md]
author_human: Jonah
author_model: claude-opus-4-8
machine: sidecoach
source: session
verified: tests / codex-review / browser
confidence: high
---

Stage 3a of the sidecoach upgrade plan (`docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`,
stamped @a22d41fc; executed at HEAD 1ea7ae73, 3 commits of non-invalidating drift).
Built by the named teammate "detect-cli" in parallel with "font-class" (Stage 4a).

## What shipped

`sidecoach/bin/sidecoach-detect.js` - one command, four lenses, no new detection logic.

Dispatch:
- URL / host -> `runRenderedAudit` (objective + subjective rendered lenses)
- directory -> static-ban + static-check
- source file -> static-ban + static-check
- local `.html` -> static-ban + static-check AND a rendered pass over its `file://` URL

Lenses: `objective` / `subjective` (rendered Playwright), `static-ban` (the 5 named absolute-ban
scanners over RAW file content), `static-check` (the product rule registry through
`run-validator`'s `evaluateCleanPolicy`).

Normalized finding shape: `{rule, severity, lens, selector|location, detail}`.

Exit codes: 0 clean, 1 findings, 2 usage/IO (no scan started), 3 inconclusive.

## Why: the fail-closed verdict is the whole point

The previous `detect` CLI was DELETED (2026-07-16 honesty-defect pass) because it faked a clean
verdict. This one generalizes `runRenderedAudit`'s discipline over N lenses: nothing attempted ->
inconclusive; nothing available -> inconclusive; **a partial scan with ZERO findings ->
inconclusive, never clean**; clean requires every ATTEMPTED lens to have actually run. A lens
deliberately skipped (`--no-render`, or the static lenses on a URL target) is reported as
`attempted: false` with a reason, so a two-lens clean can never be misread as a four-lens clean.

## How: reuse, not reimplementation

Three small ADDITIVE changes to existing modules, all behavior-preserving (goldens verify):
- `src/audit-rendered.ts` - `normalizeRenderUrl` now preserves `file://`. It previously rewrote
  `file:///x.html` to `http://file:///x.html`, so every local-file render died with
  ERR_NAME_NOT_RESOLVED. Found by probing, not by reading. `looksLikeUrl` never returns true for
  a file URL, so no existing caller is affected.
- `src/absolute-ban-detector.ts` - new `scanContentForAbsoluteBans(content, file, kind)`;
  `scanForAbsoluteBans` refactored to route through it, so directory and single-file scans cannot
  drift apart.
- `src/validators/project-collector.ts` - extracted `readCollectedFile`; new
  `collectFromSingleFile` so a single file gets the SAME source-kind matrix and read/extract path
  as the directory walk.

Threading the render URL into the validator context is what makes the static-check lens honest on
a renderable target: `run-validator` then resolves the registry's rendered-evidence rules
(contrast, heading order, hit area, typography rhythm) against real evidence instead of returning
inconclusive for all of them.

## Decision recorded: the static-ban / static-check overlap is DISCLOSED, not deduped

The `anti-pattern` validator adapts the same 5 ban scanners, so a gradient-text defect is reported
twice - once per lens, each tagged. Deduping would make a two-engine agreement indistinguishable
from a single read, and the plan explicitly asked for both paths. The overlap is documented in the
CLI header and visible in the per-lens breakdown.

## New fixture: eval/fixtures/known-good/clean-page.html

`eval/fixtures/` had no clean target, so one was authored. It is deliberately demanding - a clean
verdict needs all 6 product validators CONCLUSIVE (so the page must carry applicable evidence for
each: form, image, tokens, interactive states), zero bans, and both rendered lenses clean. Built
iteratively against the real detectors, not guessed: hit targets sized to the collector's actual
thresholds (44px buttons / 40px other controls), explicit line-height on every text-bearing
element, `:focus-visible`, neutral image outline, aria-invalid + aria-describedby, and a committed
typeface (Inter, from the shipped fontshare vocabulary). Rendered and eyeballed at 1280x640 to
confirm it is a real page, not a rules-lawyered artifact.

## Codex cross-model review (codex-cli 0.142.5) - 5 findings, all folded

No P0: Codex confirmed no path where an attempted lens fails, produces zero findings, and still
returns clean/exit 0.
- **P1 static-ban severity ignored registry overrides.** The CLI mapped the scanner's raw P0/P1/P2
  tag through SEVERITY_TABLE. But `anti-pattern.hero-metric-template` is deliberately overridden to
  `minor` in the registry while the scanner tags it P1 -> `major` -> blocking. The CLI was
  inventing policy: it would call a defect blocking that the anti-pattern validator calls
  non-blocking. Fixed with `banSeverity()` resolving through `getRuleById('anti-pattern.<ban>')`.
  Proven live: a hero-metric fixture now reports `warning` from BOTH lenses (was blocking/warning).
- **P2 unexpected scan failure exited 2 (usage) instead of 3 (inconclusive).** Everything failing
  before the scan exits 2 from inside main, so a throw reaching the top-level catch is by
  definition a scan-phase failure - now emits an inconclusive JSON and exits 3. Also contained
  throws at the lens level so a lens can never vanish from the report.
- **P2 `--help` exits 0 without a scan.** Kept (universal CLI convention); the contract is now
  documented precisely: exit 0 means clean ONLY when a result JSON was written to stdout, and a
  consumer must treat empty stdout as "no scan performed".
- **P2 single-file path identity** differs from scanning a HIGHER directory. Comment corrected to
  the claim that is actually true: identical to `collectFromPath(dirname(file))`.
- **P2 `--render-url` swallowed the next option** as its value. Now rejects a `-`-prefixed value.

## Verification (all 5 plan verify clauses, real output)

1. `node bin/sidecoach-detect.js eval/fixtures/known-defect/gradient-text.html` -> verdict
   `blocked`, emits `ban.gradient-text` at `gradient-text.html:4`, **exit 1**.
2. `node bin/sidecoach-detect.js eval/fixtures/known-good/clean-page.html` -> verdict `clean`,
   0 findings, all 4 lenses `available: true`, **exit 0**.
3. `http://127.0.0.1:1` and `http://127.0.0.1:49999/` -> verdict `inconclusive` in the stdout JSON,
   `scanned: false`, NOT clean, **exit 3** (both the unsafe-port and connection-refused paths).
4. `npm run build` green (generate-lanes + generate-validators --check + tsc), exit 0.
5. `npm test` green - **73 suites** (71 baseline + this CLI's suite + font-class's typeface suite).
   All 5 golden snapshots verify OK, which is what proves the ban-detector and collector refactors
   behavior-preserving (the scanner golden is the ONLY coverage that module has).

New suite `src/__tests__/detect-cli.test.ts` registered in `scripts/run-tests.ts`: the fail-closed
verdict matrix and exit-code classes are unit-tested directly (the bin exports `decideVerdict` /
`exitCodeFor` and guards `main()` behind `require.main === module`), plus e2e runs of all three
dispatch paths, the skipped-lens contract, the registry-severity contract, and the arg guards.

## Files touched

- `sidecoach/bin/sidecoach-detect.js` (new)
- `sidecoach/src/__tests__/detect-cli.test.ts` (new)
- `sidecoach/eval/fixtures/known-good/clean-page.html` (new)
- `sidecoach/src/audit-rendered.ts` (normalizeRenderUrl preserves file://)
- `sidecoach/src/absolute-ban-detector.ts` (scanContentForAbsoluteBans + refactor)
- `sidecoach/src/validators/project-collector.ts` (readCollectedFile + collectFromSingleFile)
- `sidecoach/scripts/run-tests.ts` (suite registration)

NOT committed - lead reviews. Stage 3b (hook path) and 3c (registry consolidation) remain open.
