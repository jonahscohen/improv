---
name: project-drift-detector wired into a real fail-closed governance CLI
description: bin/sidecoach-drift.js (NEW) turns the dead detector into token drift governance against DESIGN.md; 2 ungated tests gated + new CLI suite; 6-round Codex fold
type: project
relates_to: [session_2026-07-24_simplification-phase2-deadcode.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex (6 rounds, converged NO REMAINING FINDINGS)
confidence: high
---

# Drift detector wired to a real CLI (not committed; dist NOT rebuilt)

Resolves the built-never-wired finding from `session_2026-07-24_simplification-phase2-deadcode.md`
("project-drift-detector = 2 UNGATED test importers"). The detector is now the engine behind a real,
fail-closed token-governance command, and its coverage is in the gate.

## What shipped

- **`bin/sidecoach-drift.js` (NEW)** - given a project dir, reads its committed `DESIGN.md` baseline and
  every custom property it defines (in `.css` files AND `<style>` blocks in `.html`), and reports tokens
  that DRIFTED from the design system: off-system colors/radii/spacings/easings/durations, each named
  WITH its value and the file it drifted in. Loads the shipped engines from the committed `dist/`
  (`detectTokenDrift`, `parseDesignMd`) - value/provenance/fail-closed logic is the CLI layer, so the
  detector's interface and its `dist` build were left untouched (no dist rebuild needed).
- **Fail-closed exit contract** (distinct class per outcome; nonzero never means clean):
  `0` clean, `1` drift, `2` usage/IO, `3` inconclusive/"cannot assess". No DESIGN.md, a DESIGN.md with
  zero real governed token values, no CSS, or CSS with zero real custom properties -> `3`, NEVER a false
  "no drift". `--json` for CI, `--quiet`, `--design`/`--css` overrides.
- **Coverage gated**: enriched `project-drift-detector.test.ts` (all 5 categories + value-based/var rules)
  and NEW `drift-cli.test.ts` (fail-closed matrix, exit classes, whitespace/dup/comment/string/url/
  no-semicolon edge cases, e2e drift/clean/inconclusive/usage, inline `<style>` + symlink + hidden-file
  provenance). The two previously-ungated tests are gated + a third suite added.

## run-tests.ts lines to add (handed to lead - I did NOT edit run-tests.ts)

    { rel: 'src/__tests__/project-drift-detector.test.ts', required: true },   // token drift: pure detector, all 5 categories + value-based/var rules
    { rel: 'src/__tests__/drift-cli.test.ts', required: true },                // bin/sidecoach-drift.js: fail-closed verdict matrix + exit classes + e2e
    { rel: 'src/__tests__/sprint1-integration.test.ts', required: true },      // orchestrator DESIGN.md injection + drift e2e vs the reference project

Suggested placement: alongside the other bin-CLI suites (detect-cli / palette-recipe / direction-roll /
pre-authorship / direction-deck). Proven green via the exact `npx ts-node <file>` invocation the runner
uses (scratch harness replicating the SUITES loop). `npm test` rebuilds dist first, then runs them.

## Why this beats oracle (concrete)

oracle evaluates a page in isolation - it has no persistent design-system memory to drift FROM. OURS
compares against the project's committed `DESIGN.md` baseline. Proof: run on the real `../reference`
project it flags 7 genuinely off-system color tokens, including `--c-text-tertiary: #5E5D57` (a shipped
"darkened for WCAG AA" override of the sanctioned `#8B8A82`) that a naive whole-source scan MASKS because
the token is redefined later with the sanctioned value (last-write-wins). Governance against a known,
persistent baseline - and catching drift that a memoryless scan structurally cannot see - is the moat.

## Codex review: 6 rounds, converged (every fold re-verified the whole unit)

Foreground Codex (gpt-5.4). Findings decreased in severity each round until NO REMAINING FINDINGS:
- R1: 4 P0 + 2 P1. Whitespace normalization false-clean; commented-out props counted; unreadable/skipped
  sources still clean; shallow baseline validation (`colors:{brand:{}}` passed); no-semicolon last decl
  misparsed; tests didn't prove fail-closed e2e.
- R2: dup/override declarations false-clean (name-keyed last-wins masked a drifted override); hidden css /
  symlinked dirs skipped without recording incompleteness.
- R3: `--*` text inside a CSS string literal counted as a declaration.
- R4: `--*` inside a non-url function value counted; escaped identifiers (`--c-\78`) unassessable.
- R5: `!important` treated as part of the value (false positive on conventional CSS).
- R6: NO REMAINING FINDINGS (only the documented escaped-identifier boundary remains, out of the
  accidental-drift threat model and unfixable because the frozen detector matches names as `--[\w-]+`).

Fixes folded: collision-safe `normalizeValueWs` (collapse runs + drop spaces around `(),` - preserves
space-separated modern color components); single-pass `neutralizeCss` state machine (blanks comment/
string/url bodies by construction, replacing a fragile regex trio); per-DISTINCT-declaration checking via
`collectDeclarations` + synthetic single-decl detector calls (closes the last-wins mask); declaration-
boundary check (a `--name:` only counts after `{ ; }`, closing the "inside any function paren" class);
cycle-safe symlink following (realpath visited-set); leaf-accurate `baselineCounts`; unreadable-source ->
`scanComplete:false` -> inconclusive; `!important` stripped as priority; escaped-name limit documented.

## Self-analysis (the whitespace bug I introduced)

My first whitespace fix used `replace(/\s+/g,'')` - deleting ALL whitespace - which collapsed modern
space-separated colors (`rgb(1 23 4)` vs `rgb(12 3 4)` -> same string) into a false-negative. Why: I
reached for the simplest transform without enumerating that CSS values have TWO separator grammars
(comma-legacy and space-modern) and a blanket delete conflates them. Signal missed: "normalize for
comparison" requires knowing every value grammar you're normalizing across before choosing the transform.
Codex caught it. Lesson recorded so the next normalization starts from the grammar, not the regex.

## Verify (real output)

- `node bin/sidecoach-drift.js fixtures/drift/drift-project` -> exit 1, names 5 drifted tokens + values.
- clean-project -> exit 0; no-design / empty-tokens / no-css / no-props / comment-only / string-only /
  junk-baseline -> exit 3 "CANNOT ASSESS" (never "no drift"); missing dir -> exit 2.
- `../reference` -> exit 1, 7 genuine drifts, scanComplete true.
- 3 gated suites green via the run-tests invocation path; `npx tsc --noEmit` clean. dist NOT rebuilt by
  me (drift-relevant dist files unmodified); not committed.

## Files touched

- `sidecoach/bin/sidecoach-drift.js` (NEW)
- `sidecoach/src/__tests__/drift-cli.test.ts` (NEW)
- `sidecoach/src/__tests__/project-drift-detector.test.ts` (enriched)
- `sidecoach/fixtures/drift/{drift,clean,no-design,empty-tokens,inline}-project/*` (NEW fixtures)
- `sidecoach/src/project-drift-detector.ts` - deliberately UNCHANGED (interface + dist build frozen)
