---
name: Builder-C drive-to-green - design-tokens count + config portability
description: Item 6 (real parsed token count replaces Math.random placeholder + unit test) and Item 8 (committed settings.json registers the 4 sidecoach auto-fire hooks, READY-FOR-HUMAN-OK)
type: project
relates_to: [session_2026-08-25_sidecoach-drive-to-green.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Builder-C in the parallel sidecoach drive-to-green campaign. Two isolated items on the shared working tree, edited ONLY the two assigned files. Did NOT commit (lead integrates + Codex-reviews + audit author re-grades).

## Item 6 - design-tokens placeholder count (DEFECT FIXED, GREEN)

File: `sidecoach/src/flow-handler-design-tokens.ts`.

Was: `tokenCount: Math.floor(Math.random() * 20) + 5, // Placeholder` with fabricated example token names (`${section}.primary/.secondary/.neutral`).

Now: a deterministic line-walk over the DESIGN.md YAML frontmatter.
- Why: a green audit row was reporting a fabricated per-section token count and fake example paths; `grep -c Math.random` had to reach 0.
- How: kept section detection IDENTICAL to the prior regex (`/^(\s*)(\w+):\s*$/` per line) so `tokenSections.length` is unchanged for every downstream consumer (checklist, customData, memory metrics, message). For each detected section header, walk its subtree by indentation, count real `key: value` leaf tokens, and emit their true dotted paths (e.g. `colors.brand.red`) as the first-3 examples. A trailing-comment-tolerant nested-header matcher is used ONLY inside the subtree walk so example path prefixes stay correct; the section-push matcher stays strict for parity.

Test (new, mine to create; lead wires it into run-tests.ts):
`sidecoach/src/__tests__/design-tokens-count.test.ts` - writes a known DESIGN.md fixture to a temp dir, runs the flow, asserts exact per-section counts {colors:4, brand:2, text:2, rounded:3, motion:1, ease:1}, asserts the section set, asserts real example dotted paths, and asserts a second run yields identical counts (determinism = no randomness).

VERIFY: `grep -c "Math.random"` == 0; `npx tsc --noEmit` exit 0; test exit 0 (both PASS lines printed).
Registration line reported to lead: `{ rel: 'src/__tests__/design-tokens-count.test.ts', required: true },`

### Item 6 - Codex finding folded (2026-08-25)

Codex flagged ONE real miscount: the leaf walk only accepted plain `key: value` and IGNORED YAML list-item leaves (`- key: value`), so a token section written as a list of maps was undercounted (e.g. `spacing:\n  - sm: 4px\n  - md: 8px` reported 0, should be 2; and in a list of maps the `- name:` line was dropped while `value:` was miscounted under the parent).

Fix: added `listLeaf` (`- key: value`, keyIndent = dash indent + `- ` width, so continuation keys resolve as siblings under the parent map) and `listHeader` (`- key:` opening a nested map). Walk now classifies `leafToken(cur) || listLeaf(cur)` then `nestedHeader(cur) || listHeader(cur)`, pushing headers at `sub.indent` (unchanged for plain headers; deeper for list headers). SECTION-detection regex untouched -> tokenSections.length identical (Codex-confirmed). Regression case added to the test: list-of-maps fixture asserting {spacing:3, colors:4, palette:4} + real dotted paths (spacing.sm/md/lg, colors.palette.name/value). tsc clean, all 3 test blocks PASS, grep Math.random == 0.

### Item 6 - Codex second fold: bare scalar list entries (2026-08-25)

Codex flagged that a section written as a list of BARE SCALARS still counted 0: `breakpoints:\n  - 320px\n  - 768px\n  - 1024px` -> 0, expected 3.

Fix: added `scalarListLeaf` - a `- <value>` sequence entry with NO `key:` after the dash. Checked AFTER listLeaf/listHeader (via the `||` chain + an explicit map-entry exclusion regex `/^(key):(\s|$)/`) so `- key: value` and `- key:` never fall through. Each scalar entry is one leaf, path `parent[n]` indexed per parent list (breakpoints[0/1/2]). Section regex untouched -> tokenSections identical. Regression case added: SCALAR_FIXTURE asserting {breakpoints:3, rounded:2} + example paths [breakpoints[0], breakpoints[1], breakpoints[2]]. All 4 test blocks PASS, tsc clean, grep Math.random == 0.

## Item 8 - config portability (READY-FOR-HUMAN-OK, not auto-landed)

File: `claude/settings.json`. Cross-checked read-only against `~/.claude/settings.json`.

Added three hook arrays registering the four named sidecoach auto-fire hooks, matching live command strings + timeouts exactly:
- PostToolUse (matcher `Write|Edit|MultiEdit`): `sidecoach-taste-gate.sh` (t=30), `sidecoach-orchestrate-edit.sh` (t=120)
- Stop (matcher ``): `sidecoach-qa-gate-stop.sh` (t=10)
- UserPromptSubmit: `sidecoach-keyword.sh` (t=5)

Committed style is a curated SUBSET (registers only the sidecoach hooks in each array, not the full live chains) - matched that; did not import unrelated live hooks.

VERIFY: `comm -13 <(live) <(committed)` == empty (committed is a subset of live, no phantom hook). JSON valid.

Human-OK flag: this changes global harness behavior, so it is READY-FOR-HUMAN-OK, not landed. Also surfaced to lead: 5 live sidecoach hooks the task did NOT scope and I did NOT add - `sidecoach-heal.sh`, `sidecoach-postresponse.sh`, `sidecoach-postuserp.sh`, `sidecoach-preamble.sh`, `sidecoach-sessionstart.sh` (session-lifecycle, not the 4 auto-fire design hooks) - for the human to decide whether they belong in the committed subset too.

## Files touched
- `sidecoach/src/flow-handler-design-tokens.ts` (Item 6 fix)
- `sidecoach/src/__tests__/design-tokens-count.test.ts` (new test)
- `claude/settings.json` (Item 8, READY-FOR-HUMAN-OK)
