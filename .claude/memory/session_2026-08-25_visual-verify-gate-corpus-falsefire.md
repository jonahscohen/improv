---
name: visual-verify gate false-fired on detector-corpus fixtures
description: verify-before-done Stop gate false-blocked a non-visual (.ts/.js/.md) change because untracked data/taste-corpus/*.css/.html detector fixtures armed + corroborated the VISUAL flag; fixed by exempting *corpus dirs on all three copies
type: project
relates_to: [session_2026-08-25_builder-c-tokens-count-config-portability.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex-review
confidence: high
---

**Symptom.** The `verify-before-done-stop.sh` Stop hook blocked with "BLOCKED: a visual file changed and was never visually verified. Capture a REAL screenshot ..." on a change set that was entirely NON-VISUAL: the builder-C design-tokens COUNT work (`.ts` logic that parses YAML and returns a number, its `.test.ts`, `scripts/run-tests.ts`, compiled `dist/*.js` + `*.d.ts` + `*.map`, and `.md` beats). Nothing renders pixels.

**Root cause (empirical, not theorized).** The block requires TWO things: the session flag == "visual" AND `tree_has_visual_evidence(cwd)` == True. The reported change set's extensions were already classified correctly - `.ts`/`.d.ts`/`.js` arm "code", `.md` is exempt, `.map` arms nothing; NONE of them arm "visual". The real trigger was a DIRECTORY gap, not an extension gap:

- The only visual-extension files anywhere in the working tree were 23 untracked detector-corpus fixtures under `sidecoach/data/taste-corpus/motion.no-scale-zero-enter/` (`.css` + `.html` planted inputs the taste miner READS - not product UI).
- Writing one of those `.css`/`.html` files FALSE-ARMED "visual" (reproduced: is_visual_file returned True because `.css` is a visual ext and `data/taste-corpus/` matched no exemption).
- With the flag armed, `tree_has_visual_evidence` saw those untracked corpus files via `git status` and returned True, so the gate BLOCKED - a screenshot that could never be taken (there is no rendered surface for a detector fixture).

`data/taste-corpus/` is the SAME category as `eval/fixtures/` and `eval/corpus/`, which the hook already exempts - it just was not covered by the exemption patterns (`_NON_APP_DIR_RE` listed eval/fixtures/__fixtures__/test-fixtures/docs/reference/dependency-map/scratchpad; `_EVAL_DATA_RE` only `eval/(fixtures|corpus)`).

**Fix (durable, all three byte-identical copies + the parity test).** Added a full-segment `[A-Za-z0-9._-]*corpus` alternative to `_NON_APP_DIR_RE` so any directory segment ending in "corpus" (data/taste-corpus/, eval/corpus/, any future *-corpus) is treated as a non-rendered detector input on BOTH the arm side and the Stop corroboration side.

- Before: `(^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/`
- After:  `(^|/)(eval|fixtures|__fixtures__|test-fixtures|[A-Za-z0-9._-]*corpus|docs|reference|dependency-map|scratchpad)/`

Full-segment match preserves recall: a real UI dir that merely ends in the letters ("corpus-viewer/") STAYS armed, because "corpus-viewer" does not END in "corpus"; only a segment that IS `*corpus` is exempt. Files touched (identical string in all four):
- `claude/hooks/verify-before-done.sh` (arm side, `_NON_APP_DIR_RE`)
- `claude/hooks/verify-before-done-stop.sh` (Stop corroboration, `_NON_APP_DIR_RE`)
- `claude/hooks/bash-guard.sh` (commit-gate grep classifier, ~line 1762)
- `claude/hooks/test-verify-visual-gate.sh` (the `want` literal the 3-way parity test asserts)

**Why this shape:** the governing principle is "does this change plausibly alter rendered pixels a human would look at?" A `*corpus` directory holds planted detector inputs, never product UI. Narrowing by DIRECTORY (not by loosening the `.css`/`.html`/`.tsx` extension set) means genuine UI stays fully gated - the whole point of the visual-verify protocol. `.css`/`.scss`/`.less`, `.html`, `.tsx`/`.jsx`/`.vue`/`.svelte` still arm + block everywhere OUTSIDE a corpus/fixtures/eval dir.

**Verification.** Reproduced both false-fires BEFORE (taste-corpus `.css` write armed "visual"; Stop blocked against the live tree) and confirmed BOTH cleared AFTER (write arms nothing; Stop allows against the same live tree). Added 10 test rows to `test-verify-visual-gate.sh` (corpus arms nothing; look-alike + real UI still arm; Stop allows a corpus-only tree but blocks when a real `src/theme.css` is added; the reported non-visual change set never reaches "visual"; a genuine `.html/.css/.tsx` set DOES). Suite: 44 -> 54 passed, 0 failed. Sibling suites green: test-verify-before-done.sh (179), test-verify-session-isolation.sh (11). `bash -n` clean on all three hooks. Commit-gate grep classifier verified directly on corpus vs real-UI paths.

**Live status:** Stop/PostToolUse hooks are re-read per invocation, so the fix is LIVE IMMEDIATELY - no session restart needed.

**Cross-model review (Codex, via ~/.claude/hooks/codex-review.py - real Codex, exit 0).** Confirmed all four: the regex matches ONLY a full segment ending in "corpus" (data/taste-corpus/, eval/corpus/, bare corpus/) and NOT a look-alike (corpus-viewer/); no ReDoS; semantically identical in Python `re` and POSIX ERE (`.`,`_`,terminal `-` all literal in the bracket class). Two Low findings, both folded: (1) the exemption is name-anywhere, so a hypothetical FUTURE product-UI dir literally named `*-corpus` would be exempt - accepted as policy (same shape as the existing docs//reference//fixtures/ entries) and now PINNED by a "data/ visual file NOT under a corpus dir STILL arms" test row proving the bypass is not a blanket data/ hole; (2) the "reported change set never arms visual" row is an extension-classifier regression guard, not proof of the corpus regex - relabeled honestly in-place. Suite after folding: 55 passed, 0 failed.

**Self-analysis (why the gap existed).** The exemption set grew case-by-case (eval, then fixtures, then docs/scratchpad/dependency-map) each time a specific false-fire cost a manual override. `data/taste-corpus/` is a NEW detector-input location introduced by the taste-miner work that post-dates the last exemption pass, so it was never added. The lesson: detector-corpus / training-fixture directories are a FAMILY; keying the exemption on the `*corpus` naming convention (rather than one more literal path) closes the whole family instead of waiting for each new corpus dir to draw its own false-block.

**Follow-up (same session, team-lead ask): __tests__/ directory segment.** The team-lead flagged the same gate firing on test-fixture `.html`/`.css` generally, listing the segments it must exempt: `/__tests__/`, `/fixtures/`, `/taste-corpus/`, `/eval/`, `/test-corpus/`, and a `*.test.*` name. Empirically checked all six against the committed corpus fix: fixtures/, taste-corpus/, eval/, test-corpus/ (via `*corpus`), and `*.test.*` were ALREADY covered. The ONE genuine gap was `__tests__/` - a `.css`/`.html` directly under a Jest `__tests__/` dir has no `.test.` basename infix, so `_TEST_FILE_RE` missed it and `__tests__` was not in `_NON_APP_DIR_RE`; such a file still armed "visual". Added `__tests__` to the alternation (same three byte-identical copies + parity literal). Committed separately (`__tests__` follow-up). Tests: 55 -> 60, 0 failed - added rows prove taste-corpus pos-*.html/neg-*.css, fixtures/*.css, __tests__/*.html+*.scss, test-corpus/*.html all arm NOTHING and a __tests__/fixtures-only tree ALLOWS at Stop, while real component/site/marketing `.css`/`.html`/`.tsx` still arm + block.

Final `_NON_APP_DIR_RE` (all three hooks + parity test):
  `(^|/)(eval|fixtures|__fixtures__|test-fixtures|__tests__|[A-Za-z0-9._-]*corpus|docs|reference|dependency-map|scratchpad)/`

Files touched:
- claude/hooks/verify-before-done.sh
- claude/hooks/verify-before-done-stop.sh
- claude/hooks/bash-guard.sh
- claude/hooks/test-verify-visual-gate.sh
