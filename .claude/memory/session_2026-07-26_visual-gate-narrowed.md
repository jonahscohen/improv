---
name: Visual-verification gate narrowed (deletions / dev-docs / scratchpad / subagent)
description: Killed 4 classes of false-fire in the screenshot gate across all 3 sites (arm, Stop, commit) without gutting the real guard
type: project
relates_to: [session_2026-07-24_visual-gate-override-eval-fixtures.md, session_2026-07-23_verify-visual-arm-reference-narrowed.md, feedback_hooks_prefer_false_positives.md, decision_verify_hook_quoted_mention_arming.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: improv
source: session
verified: tests (hook unit suites, all green) + codex-review
confidence: high
---

The "visual verification" gate (arms `~/.claude/.needs-verification.<session>`, Stop hook + git-commit gate BLOCK until a real screenshot) was false-firing on non-renderable changes. Narrowed the FALSE-FIRES at all three sites while keeping the real app-UI guard intact. Do NOT commit was the standing instruction - diff handed to lead.

**The gate has THREE sites that independently classify "visual file"; all three now AGREE:**
1. `claude/hooks/verify-before-done.sh` - ARM (PostToolUse). Sets the flag.
2. `claude/hooks/verify-before-done-stop.sh` - STOP. `tree_has_visual_evidence()` re-derives from `git status`.
3. `claude/hooks/bash-guard.sh` - COMMIT gate (~line 1590). Re-derives from `git diff --cached`.

**The four false-fire classes fixed (each reproduced first, then fixed):**

- **File DELETIONS.** A removed `.html`/`.css` cannot be screenshotted, but the deletion record still carries a visual PATH.
  - STOP: `tree_has_visual_evidence` now reads the porcelain XY status (`status = c[:2]`) and `continue`s when `"D" in status` (worktree ` D`, staged `D `). Renames (`R`) and copies (`C`) are NOT skipped - a rename still renders.
  - COMMIT: staged files now pulled with `git diff --cached --name-only --diff-filter=d` (lowercase d EXCLUDES deletions).
  - ARM: a plain `rm`/`git rm` never armed (not a write verb) - already correct; left as is.
- **Non-app dev-doc / test / fixture paths.** A visual file under `docs/`, `reference/`, any `fixtures/`, `eval/`, `dependency-map/`, `scratchpad/` is not product UI.
  - Shared regex `_NON_APP_DIR_RE = (^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/`, byte-identical in all three files (a test asserts the three literals match). SEGMENT-anchored so `reference-site/` != `reference/` and `docs-panel/` != `docs/` still ARM.
  - ARM: added to `is_exempt` (fully exempt = arms nothing). STOP + COMMIT: added as a skip in the tree/staged scan.
- **Scratchpad / temp.** `/private/tmp/.../scratchpad/x.html` armed visual (only DIRECT temp children were exempt before). `scratchpad/` is now in `_NON_APP_DIR_RE`. The 2026-07-24 direct-child /tmp rule is KEPT (nested product UI under /tmp still arms - see reconciliation below).
- **Subagent/teammate edit arming the PARENT flag.** The flag is session-keyed; a sidechain edit could land on the parent key and block the parent Stop. The arm hook previously SET the flag then only muted the nudge for subagents. Now `IS_SUBAGENT` skips `set_flag` entirely (both the Write/Edit path and `arm_and_report`). Subagents are already Stop-exempt, so the flag was meaningless for them.

**Why (rationale):** the gate exists to force a screenshot on real UI changes; its own law (`feedback_hooks_prefer_false_positives`) prefers over-arming to under-arming. Every narrowing here removes only paths that render NO product surface (a deletion literally cannot be photographed; docs/fixtures/scratchpad are not app UI; a subagent is already exempt), so recall on real app UI is unchanged - proven by recall control rows in every suite.

**How (mechanics):** one shared segment-anchored regex + explicit deletion detection (porcelain status / `--diff-filter=d`) + moving the subagent check ahead of `set_flag`.

**Reconciliations flagged to lead (two lead directives softened to preserve documented Codex-reviewed decisions + existing tests):**
- Lead said "don't arm on /tmp, /private/tmp". The 2026-07-24 decision (locked by tests `nested product .tsx under /tmp still arms visual`) deliberately keeps nested-repo-under-/tmp arming to avoid under-arming a real project checked out in temp. Kept that; added only `scratchpad/`, which covers the concrete `/private/tmp/.../scratchpad/x.html` false-fire. A bare `/tmp/x.html` direct child already declassifies to "code" (no screenshot demand), so no visual false-fire remains.
- Lead said "*.test.* don't arm". Existing tests deliberately assert `.test.tsx`/`.spec.tsx` arm "code" (never visual, never a screenshot demand). Kept that at the ARM site (a "code" flag causes no screenshot theatre); ADDED `.test.`/`.spec.` skips at STOP + COMMIT (where a staged/tracked `.test.tsx` WOULD have blocked). Net: test files never demand a screenshot nor block, matching the lead's intent.
- Broadened bare `fixtures/` and bare `eval/` to segment-anchored exemptions per the lead; this flips two intentional arm-tests (`preeval/fixtures/x.html` was asserted visual). Updated those two rows to expect exempt and ADDED eval-anchor controls (`preeval/pages/x.html` still arms) so the anchor coverage is preserved.

**Known residual (documented, safe direction):** `mv src/x.html /tmp/trash/` still arms visual at the ARM site (mv counts source+dest per Codex 2026-07-23). Harmless: the moved-away file shows as a DELETION in the tree, so STOP allows and COMMIT excludes it - the teeth neutralize it. Also `pages/docs/Foo.tsx` (a docs route under a real app) would be skipped by the `docs/` exemption - an accepted under-arm the lead's "docs/** is not product UI" directive implies.

**Verification (all green):**
- `test-verify-before-done.sh` 179/179 (arm side + new docs/reference/scratchpad exempt + reference-site/docs-panel look-alike controls).
- `test-verify-visual-gate.sh` 44/44 (new: STOP deletions/docs/scratchpad/fixtures/test allow, recall still blocks, 3-way regex sync, subagent no-arm).
- `test-bash-guard-commit.sh` 156/156 (new gate-2 narrowing: 8 rows - deletions/docs/eval/scratchpad/test allow, real UI + reference-site still block).
- `test-verify-session-isolation.sh` 11/11, `_tests/test-second-fix-gate.sh` 11/11.
- 3 pre-existing `memory-nudge` failures in `test-nudge-debounce.sh` are UNRELATED (proven by stashing my edits and re-running - same 3 fail on baseline; `memory-nudge.sh` untouched).

Files touched: claude/hooks/verify-before-done.sh, claude/hooks/verify-before-done-stop.sh, claude/hooks/bash-guard.sh, claude/hooks/test-verify-before-done.sh, claude/hooks/test-verify-visual-gate.sh, claude/hooks/test-bash-guard-commit.sh.
