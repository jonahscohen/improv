---
name: verify-before-done hook - the demand now matches the flag (no more screenshot theatre)
description: The verify hook ordered a screenshot for every code change including non-visual ones; it now emits a logic-verification demand for non-visual code while preserving (and improving) visual recall
type: project
relates_to: [feedback_hooks_prefer_false_positives.md, session_2026-07-17_sidecoach-eval-harness-wired-into-gate.md, session_2026-07-18_verify-flag-session-keyed-reigned-in.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (test-nudge-debounce.sh 46/46, was 17; probe matrix 13/13; four real Codex findings folded across three review passes)
confidence: high
---

Jonah, 2026-07-17: "Please reign that hook in. It is bothering everyone who interacts with it."

## The defect

`claude/hooks/verify-before-done.sh` (symlinked to `~/.claude/hooks/`, PostToolUse on
Write|Edit|MultiEdit|Bash) already computed visual (.css/.tsx/.html) vs non-visual
(.ts/.py/.go/.sh) correctly and stored it in `~/.claude/.needs-verification` as
"visual" or "code". But BOTH additionalContext strings hardcoded "Take a screenshot".

So editing a test runner, a Python ETL script, or building a CLI library demanded a
screenshot of something with no rendered surface. That demand cannot be satisfied
honestly, so readers learned to ignore the hook - the boy-who-cried-wolf threshold named
in [[feedback_hooks_prefer_false_positives]]. Proven by probe before touching it: .ts,
.py, and `npm run build` all emitted "Take a screenshot, EXAMINE it critically".

## The fix

New `verify_message(prefix)` picks wording from `flag_content()` read AFTER `set_flag`:
- flag "visual" -> the original screenshot demand, unchanged.
- flag "code" -> a logic demand: run its tests, a probe, or curl, and report REAL output;
  explicitly says there is nothing to screenshot and not to screenshot to satisfy it.

**Why this shape:** the standing rule permits fixing a noisy hook ONLY if the fix
"preserves recall on the true-positive cases". Changing wording alone does exactly that -
`set_flag` still fires on precisely what it fired on before and bash-guard still blocks
`git commit`. Verified: arming flags byte-identical to the old hook across a 14-case
matrix. Zero recall loss by construction, because arming was never touched.

## Two real Codex findings folded (both were recall LOSSES I introduced/exposed)

1. `arm_and_report()` hardcoded `set_flag("code")`, so a Bash write to a VISUAL file
   (`sed -i src/app.css`, `tee src/App.tsx`, `cp theme.css ...`) armed "code" and got a
   logic-only demand. LATENT since the flag existed (the old hook set "code" there too),
   but harmless while both messages said "screenshot" - making the flag load-bearing is
   what exposed it. Fix: `arm_and_report(kind)`; the file-write branch passes "visual"
   when any operand `is_visual_file`. **Visual recall is now strictly BETTER than the old
   hook**: old armed code on `sed -i src/app.css`, new arms visual.
2. `deploy_indicators` ran BEFORE the file-token check, so
   `sed -i s/a/b/ src/app.css && npm run build` matched the build first and armed "code",
   losing the named visual file. Fix: extract file operands ONCE before the deploy check;
   if any operand renders UI the whole command arms visual regardless of branch.

Sticky-visual is preserved throughout (`set_flag` never downgrades visual -> code), so a
.css edit followed by a build still demands a screenshot - the 2026-06-22 hole stays shut.
Locked in as a test row.

## Coverage

`claude/hooks/test-nudge-debounce.sh` gained Case D (a 10-row table asserting BOTH the
demand kind and the flag for css/tsx/ts/py/go/build/bash-visual-write/bash-code-write/md,
plus a sticky-visual row) and Case E (8 rows for UI-project detection: next/react build,
CLI build, cd-into-subdir both ways, no-package.json, css-named-in-a-cli-build,
trailing-cd, peerDep component lib). Suite: 17 -> 46 assertions, all pass. Every Codex
finding is pinned as a row so none can silently return.

Note the Case D "build cwd unknown" row: its payload carries no cwd, so the hook cannot
identify a project and deliberately over-fires to visual. That row FAILED when Case E
landed - it encoded the pre-UI-detection assumption, and the stale expectation was wrong,
not the hook. Builds with a known cwd are covered in Case E.

## Self-analysis

My 14-case matrix "proved" zero recall loss and I believed it - but it contained no Bash
write to a visual file, which is exactly where the regression was. The lesson is that a
matrix proves only what it enumerates; I built it from the paths I had just edited rather
than from the hook's actual branch structure (Write/Edit arm side AND Bash arm side, each
with visual/non-visual variants). A coverage argument should be derived from the branches,
not from the diff. Codex read the branches and found in one pass what my matrix missed.

## Builds are now judged by the PROJECT (Jonah decision)

Codex then flagged that a standalone `npm run build` armed "code", losing visual recall in
a UI project - but making ALL builds demand a screenshot restores the original complaint.
Genuine noise-vs-recall tradeoff, so it went to Jonah, who chose UI-project detection.

`project_has_ui()` walks up to the nearest package.json (6 levels max) and returns visual
iff it declares a UI framework (react/next/vue/svelte/vite/tailwind/...) in
dependencies / devDependencies / **peerDependencies** / optionalDependencies, or exposes a
dev/start/serve/storybook/preview script. `effective_dir()` honors a LEADING `cd` so
`cd sidecoach && npm run build` is judged against sidecoach. No/unreadable package.json ->
visual (deliberate over-fire).

**Why deps and NOT a filesystem scan:** sidecoach ships a `pages/` dir and eval `.html`
fixtures it never renders as its own UI, so scanning for .css/.html reports "UI" for a CLI
library and restores the exact noise being removed. Declared dependencies do not lie.

Jonah also chose to KEEP `if not file_tokens: arm_and_report()` defaulting unknown/indirect
writes (`tee "$TARGET"`) to "code" - deliberate, to keep the noise floor low. Not a defect.

Two further Codex findings folded, both false NEGATIVES (the dangerous direction):
- `effective_dir` used `re.search`, matching ANY `cd`. `npm run build && cd ../cli` from a
  UI project judged ../cli and downgraded a real UI build. Now `re.match` - leading cd only.
- `project_has_ui` ignored `peerDependencies`, where a component library declares react
  while shipping no dev/start script -> a real UI package read as non-UI.
Both pinned as test rows.

## Files touched

- claude/hooks/verify-before-done.sh
- claude/hooks/test-nudge-debounce.sh
