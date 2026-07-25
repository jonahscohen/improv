---
name: Stage 2a palette-construction recipe
description: bin/sidecoach-palette.js + src/palette-recipe.ts - deterministic OKLCH ramps, fail-closed WCAG gate through the SHIPPING objective scanner, DESIGN.md token emit
type: project
relates_to: [session_2026-07-24_stage3c-registry-consolidation.md, session_2026-07-24_stage4b-groundb-live-wiring.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + browser (playwright scanner) + @google/design.md lint
confidence: high
---

Stage 2a of the sidecoach upgrade plan (`docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`) SHIPPED (not committed). A deterministic palette-construction recipe that fills the generative gap and feeds the rendered-WCAG engine.

## What was built
- **`bin/sidecoach-palette.js`** - CLI. From a `--brand <file>` JSON (name + base/primary OKLCH anchors, optional semantic overrides + fonts) it builds a palette, WCAG-gates it, and emits DESIGN.md to stdout ONLY on a clean pass. House style copied from `bin/sidecoach-detect.js` (require ../dist, exit-code contract, fail-closed).
- **`src/palette-recipe.ts`** (NEW module) - pure construction: OKLCH->sRGB (Ottosson OKLab) with chroma-reduction gamut mapping, fixed 10-stop lightness ramps for neutral base + primary + 4 semantic roles, required-pair definitions, swatch-page builder, verdict resolver, DESIGN.md emitter. NO browser, NO contrast math.
- Fixtures `eval/fixtures/palette/brand-pass.json` (Northwind, indigo primary) + `brand-fail.json` (Midtone Miss, magenta primary pinned to the mid-lightness 500 solid).
- Test `src/__tests__/palette-recipe.test.ts` + one required-suite line in `scripts/run-tests.ts`.

## How the contrast reuse works (the load-bearing integrity point)
The contrast check is NOT reimplemented. The recipe builds ONE HTML page of labeled swatches (one `<div id="<pairname>">` per required text/bg pair, 16px for normal / 28px for large) and hands it to the SHIPPING `scanObjectiveRendered` from `src/validators/objective-rendered-scanner.ts` - the exact engine `/sidecoach audit` and the detect CLI use. It reads back `low-contrast` findings and maps each finding's selector (`div#<id>`) to its pair. There is exactly one contrast implementation in the product and it is the scanner's; the recipe never derives a luminance or ratio.
**Why via swatches, not a shared function:** the scanner's WCAG math lives INSIDE `inPageObjective()` as closures serialized to the browser by `page.evaluate` - not exported. Feeding it swatches is the genuine single-source reuse (the finding's ratio detail is the scanner's own), not a copy.

## Fail-closed (the required property) - PROVEN
- Contrast failure: `brand-fail.json` exits **1**, stdout **0 bytes** (no palette), stderr names `on-primary` with `light 3.47:1 (need 4.5:1); dark 4.00:1 (need 4.5:1)`. A mid-tone magenta solid is a real dead zone where neither a light nor dark label reaches AA.
- Scan did not run: forcing `PLAYWRIGHT_BROWSERS_PATH=/nonexistent` -> exit **3 inconclusive**, 0 bytes, NEVER clean.
- On-color choice is scanner-authoritative: two candidates (paper/ink) per accent are rendered; the verdict picks the one the scanner verified (prefer paper), and fails-closed only when BOTH fail. No local luminance calc decides it.

## Deterministic
Same `--brand` twice -> byte-identical stdout (sha-verified). OKLCH->sRGB is pure; the emitted DESIGN.md is a pure string build (no clock, no map-order dependence). The on-color choice depends on the scanner, which is deterministic (hermetic render, document-ordered walk, pure math).

## DESIGN.md conformance
Emitted frontmatter follows the @google/design.md v0.3.0 spec: `colors.primary` defined, `rounded.none: 0px` (bare `0` is an ERROR), flat hyphenated ramp keys (`primary-700`), canonical 8-section body order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts). `npx @google/design.md lint` = **errors: 0**, warnings 47 (all "ramp stop defined but never referenced by a component" - inherent to shipping a full 10-stop ramp; the plan requires the full ramp). Body prose has **0 hard-coded hex** - all `{token.path}` references (team rule); hex lives only in frontmatter (the token source).

## Decisions
- **On-accent = dual-candidate scanner pick, not a local contrast calc.** Why: keeps ONE contrast source (the scanner) and still yields the correct label (dark text on yellow, light on navy). A local luminance-based pick would be a second contrast impl.
- **Fail fixture uses a mid-tone solid (primary.solidStop:500), not a light/yellow accent.** Why: the on-color dual-candidate design correctly rescues light/yellow accents (picks the passing neutral), so the only robust both-fail case is the luminance dead zone (solid Y roughly 0.17-0.25). Empirically probed candidates through the real scanner and locked magenta #c462a7 (best candidate 4.00:1, a 0.5 margin below 4.5, the most rounding-robust).
- **Full 10-stop ramps despite lint warnings.** Why: the plan says "each an OKLCH lightness ramp"; lint's "unreferenced stop" is advisory (errors:0), and referencing all 60 stops in components would be fabrication.

## Codex review (deterministic wrapper, NOT codex-rescue) - 3 rounds
Ran `git diff HEAD | ~/.claude/hooks/codex-review.py` (codex-cli 0.142.5) three times; each folded, re-verified.
- **R1 High:** emitted badge backgrounds + the verified-pairs table hard-coded `{colors.<fam>-700}` while `requiredPairs()` scans `p.solidStop[fam]` - a semantic `solidStop` override would make DESIGN.md document a pair the scanner never verified. **Fold:** added per-family top-level SOLID aliases (`colors.primary/success/warning/danger/info` = the actual-solidStop hex); badges + table now reference `{colors.<fam>}`; hover/active derive their stop from the actual solid via new `darkerStop()`, not hard-coded 800/900.
- **R2 High (same class, deeper):** button hover/active emit DARKER backgrounds inheriting `on-primary` text, but only the base solid was verified - a light-pinned primary could ship a failing active-state label (Codex traced solid 6.06:1, hover 4.29:1, active 2.94:1). **Fold (comprehensive verification):** `requiredPairs()` now emits paper+ink on-color candidates on EVERY surface the recipe emits (`accentSurfaces`: primary=solid+hover+active, semantics=solid); `resolveVerdict()` accepts a candidate only if it passes on ALL that accent's surfaces (`groupPasses`), else fail-closes naming the surface. Also added `alert-<fam>` tint pairs + a secondary-text-on-sunken well pair as hard requirements. Result: EVERY emitted component text/bg pair is scanner-gated (Codex enumerated the components block vs requiredPairs and found zero gaps). New test (d2) proves a candidate passing the solid but failing a darker STATE is rejected.
- **R3: Findings: None.** Confirmed no emitted pair escapes the gate, no exit-0 hole, no determinism/correctness regression (darkerStop clamping = redundant checks, not false passes). PASS now reports 18/18 pairs (13 hard + 5 accents).

## Cross-cutting note (concurrent stage4b churn - RESOLVED, was never my failure)
Mid-session, full `npm test` transiently showed 1-2 failures from a CONCURRENT stage4b edit to `subjective-rendered-scanner.ts` + `product-rule-registry.ts` (orphan `extreme-negative-tracking`; then TS2552/TS2304 `isHeadingEl`/`sourceAllCaps` compile errors from a broken mid-save caught by suites that import that scanner). Those files are stage4b-owned; I am barred from touching them and my unit never imports the subjective scanner (I use `objective-rendered-scanner`). Debugging-Protocol delta was unambiguous (green baseline 75 @20:32 -> teammate edits @20:52+ -> failures). Once the teammate COMPLETED their edit, the final `npm test` = **77 suite(s) passed, exit 0, fully green** (75 original baseline + my palette suite + a concurrent teammate's suite). No action needed from me.

## Files
- NEW `sidecoach/bin/sidecoach-palette.js`
- NEW `sidecoach/src/palette-recipe.ts`
- NEW `sidecoach/eval/fixtures/palette/brand-pass.json`, `brand-fail.json`
- NEW `sidecoach/src/__tests__/palette-recipe.test.ts`
- EDIT `sidecoach/scripts/run-tests.ts` (+1 required suite line; baseline 75 -> 76)

## Verify (real results)
- PASS brand: exit 0, 308-line DESIGN.md emitted, 13/13 required pairs pass.
- FAIL brand: exit 1, on-primary named, 0-byte stdout. Inconclusive path: exit 3.
- `npx @google/design.md lint`: errors 0 (warnings 51, all "ramp stop unreferenced by a component" - inherent to a full 10-stop ramp).
- Determinism: byte-identical across two runs (sha ff2d9a2c).
- `npm run build` clean; my suite passes standalone (incl. browser e2e) AND in the full run. Final `npm test` = **77 suites passed, exit 0** (all green after concurrent stage4b churn resolved).
- Codex 3 rounds via the deterministic wrapper: 2 Highs folded, final round no findings.
