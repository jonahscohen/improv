---
name: Stage 4b - default-typeface Ground B wired LIVE (committed family from DESIGN.md)
description: Ground B (brand mismatch) was inert because nothing supplied a committed family on the live path. Wired DESIGN.md typography tokens -> loadCommittedFontFamilies -> run-validator + audit-rendered -> the scanner's existing Ground B seam. Fail-closed by construction; A5a reproduces R=1.000 P=1.000 FP=0/18; 76 suites green.
type: project
relates_to: [session_2026-07-23_sidecoach-stage4a-default-typeface.md, session_2026-07-24_a5a-CERTIFIED-hardened-ground-truth.md, session_2026-07-24_autonomous-wave1-dispatched.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - npm test 76 suites green (baseline 75 + 1 new), npm run build clean w/ generate-validators --check no drift, A5a re-run R=1.000 P=1.000 FP=0/18 exit 0, Codex 2 rounds (1 High folded, confirmed closed)
confidence: high
---

Collaborator: Jonah. 2026-07-24. HEAD e378a632, nothing committed. Teammate "groundb". Finishes Stage 4a's Ground B, which shipped calibrated + unit-tested but INERT on the live path.

## What was inert and why
The `default-typeface` rendered taste class (subjective-rendered-scanner.ts) has two grounds. Ground A (default/system stack >= 75% of char-weighted content) was already LIVE. Ground B (a KNOWN committed family carrying < 25% of content text, BRAND_PRESENCE_MIN=0.25 frozen) was fully implemented behind a seam (`TypefaceFindingOptions.brandFamilies`, threaded through `analyzeHtmlOnBrowserSubjective` / `scanRenderedLive` / `scanSubjectiveRendered`) but nothing on the live path ever supplied a committed family, so it never fired. The blocker was that no committed-family source existed.

## Where the committed family comes from (determined from the repo, not invented)
DESIGN.md `typography` token frontmatter. It is the ONE place a project names a CHOSEN typeface (`typography.<role>.family` for display/body/mono); PRODUCT.md carries no font tokens. This matches the existing consumer `flow-handler-typography-excellence.ts`, which already reads `typography.display.family` / `typography.body.family` off the parsed DESIGN tokens. The reliable parse is the YAML `parseDesignMd` (design-md-parser.ts) - NOT the flat line parser in project-context.ts's ContextLoader, which drops nested typography structure. Only one plausible source, so no ambiguity to flag beyond this.

## What was wired
1. **project-context.ts (owned):** added `committedFontFamilies(typography)` + `loadCommittedFontFamilies(projectPath)`.
   - `committedFontFamilies` takes the LEAD family of every `typography.<role>.family` stack (quote-aware, mirroring the scanner's splitFamilies so a quoted-comma name survives), dedupes, and DROPS system/generic leads by reusing the scanner's own `SYSTEM_FONT_STACK_FAMILIES` from reference-data.ts (single-sourced with the detector). Original-case out (clean finding message; scanner lowercases for match).
   - `loadCommittedFontFamilies` resolves DESIGN.md at the project root (case variants, root-only, matching ContextLoader) and returns `committedFontFamilies(parseDesignMd(content).typography)`. FAIL-SAFE: missing / unreadable / frontmatter-less DESIGN.md all return `[]`.
   - **Why (the load-bearing property):** when nothing is committed the result is `[]`, the scanner reads an empty list as "no brand declared", and Ground B never fires. A page with no committed typeface is not a mismatch. Dropping system-only leads means a DESIGN.md that "commits" only sans-serif/system-ui also yields `[]` - that is Ground A's domain, not a brand Ground B can mismatch against.
2. **run-validator.ts (owned):** `committedFamiliesForContext(context)` reads `context.projectPath` (in-memory contexts with no projectPath -> `[]`) and the single live-scan call now passes `brandFamilies.length ? { typeface: { brandFamilies } } : undefined` to `scanRenderedLive`. Widened the `deps.scanRenderedLive` seam to the real 3-arg `(url, signal?, opts?)` (a 2-arg injected double stays assignable).
3. **audit-rendered.ts (owned):** `runRenderedAudit` now derives `brandFamilies` from `deps.committedFamilies ?? loadCommittedFontFamilies(deps.projectPath ?? process.cwd())` and forwards the same `{ typeface: { brandFamilies } }` (undefined when empty). Widened the `scan` seam to accept `(url, signal?, opts?)`.
4. **sidecoach-orchestrator.ts (fold, NOT in my primary owned set - see Codex below):** the `/sidecoach audit <url>` call now passes `{ projectPath: context.projectPath || process.cwd() }`, the exact idiom already used twice in the same method (lines 890, 920), so the audit scopes the committed family to the audited project rather than a blind cwd.

**rendered-checks.ts (owned) NOT changed:** `checkDefaultTypeface` was already Ground-B-aware (branches on `typefaceGroundOf` for brand-mismatch vs default-stack verdict text). Wiring the data in was sufficient; no check edit needed.

## Non-negotiables held
- Ground A behaviour untouched; BRAND_PRESENCE_MIN=0.25 untouched; the scanner class touched ZERO lines (data passed IN through the existing seam).
- A5a untouched: `eval/typeface-a5a.mjs` grades `typefaceFindingFromScore(score, {})` with EMPTY opts and imports only the dist scanner - it never reaches project-context/run-validator/audit-rendered. Re-run confirms OURS R=1.000 (5/5) P=1.000 FP=0/18, exit 0, unchanged.

## Verify results (all REAL)
1. Fixture project WITH committed family + content mostly a DIFFERENT family FIRES Ground B: e2e(1) - `loadCommittedFontFamilies` -> ['Verge Serif'] on a page set in Alluvium Sans -> exactly 1 default-typeface finding, detail starts `brand-mismatch:`.
2. Committed family that IS used does NOT fire: e2e(2) - ['Alluvium Sans'] on the same page -> 0 findings.
3. **NO committed family does NOT fire (the property that matters most):** e2e(3) - no DESIGN.md -> `[]` -> Ground B silent -> 0 findings. Asserted at three layers: extraction ([]), both forwarding paths (opts undefined handed to the scanner), and the real scanner (0 findings).
4. `node eval/typeface-a5a.mjs` (SIDECOACH_ORACLE_DETECT=/tmp/oracle-v4/skill/scripts/detect.mjs): OURS R=1.000 P=1.000 FP=0/18, exit 0.
5. `npm test` = **76 suites** green (baseline 75 + new default-typeface-ground-b-wiring.test.ts, 23 assertions); `npm run build` clean, `generate-validators --check: OK ... no drift`.

## Codex cross-model review (deterministic wrapper codex-review.py, gpt-5.4, 2 rounds)
Round 1 (168s): confirmed run-validator no-brand paths fail-closed, no Ground A/scanner regression, A5a unaffected, loadCommittedFontFamilies fail-safe on all named failures. ONE **High**: the orchestrator's `/sidecoach audit` passed no project path, so audit-rendered fell back to a blind `process.cwd()`; if the Sidecoach context points at project A (no DESIGN.md) while cwd is project B (with typography), Ground B could pick up B's family and false-fire - a hit on the sacred property in a cross-project scenario. FOLDED at the orchestrator call site with `context.projectPath || process.cwd()`.
Round 2 (65s): confirmed the High is CLOSED (audit now scopes to the audited project root) and NO new issue - Ground B cannot false-fire without committed families; Ground A still fires independently for real default-stack rendering.

## New test suite
`src/__tests__/default-typeface-ground-b-wiring.test.ts` (registered required in scripts/run-tests.ts). Hermetic - builds temp DESIGN.md fixtures at runtime, no repo fixture files added. Covers: extraction (lead/dedupe/system-drop/quoted-comma), run-validator + audit forwarding (capturing injected scan, asserts opts.typeface.brandFamilies populated with a brand and UNDEFINED without), and the 3 required end-to-end firing checks via the real scanner (analyzeHtmlOnBrowserSubjective, one browser launch). Uses analyzeHtmlOnBrowserSubjective not scanSubjectiveRendered because the latter owns+closes the browser (caught mid-build - reusing one browser across 3 calls failed after the first).

## Left undone / notes
- Nothing committed (lead integrates the wave). `git add -N` was used on the new test so it appeared in the review diff; no other index changes.
- bin/sidecoach-detect.js also calls `runRenderedAudit(renderUrl)` and defaults to cwd - correct for the CLI (it runs in the audited project) and left untouched (bin/ is do-not-touch).
- The scanner's shadow-DOM limit (unchanged from 4a) and the Inter/Poppins-monoculture honest exclusion (Ground A's, unchanged) both still stand.

## Files
Modified: src/project-context.ts, src/validators/run-validator.ts, src/audit-rendered.ts, src/sidecoach-orchestrator.ts (1-line audit call-site fold), scripts/run-tests.ts (1 suite registration line).
Created: src/__tests__/default-typeface-ground-b-wiring.test.ts.
Untouched-but-owned: src/validators/checks/rendered-checks.ts (already Ground-B-aware).
