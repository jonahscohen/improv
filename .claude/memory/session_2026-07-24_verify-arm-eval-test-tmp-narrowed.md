---
name: verify-before-done visual arm narrowed to skip eval fixtures / test probes / OS-temp scratch
description: The visual Stop gate fired 3x in one session on writes to sidecoach/eval/fixtures/**/*.html and *.test/*.spec files (no rendered surface); added an anchored eval-relative + test-infix + direct-temp-scratch carve-out on the visual-arm classifier, folded a Codex recall finding, both directions negative-controlled
type: project
relates_to: [session_2026-07-23_verify-visual-arm-reference-narrowed.md, session_2026-07-23_verify-arm-lead-verification-project-has-ui-gap.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: Mac
source: session
verified: tests (6 suites green; test-verify-before-done 145->168 with +23 negative-controlled rows both ways) + live-hook run proof (arms vs not-arms through the ~/.claude symlink) + 2 rounds of Codex review folded
confidence: high
---

Jonah, 2026-07-24 (teammate arm-narrow). The `verify-before-done` visual Stop gate false-fired three
times in one session on writes to `sidecoach/eval/fixtures/**/*.html` (constructed detector/labeler
probe inputs) and to `*.test.*` / `*.spec.*` files - none of which have a rendered product surface,
so each demand for a screenshot was unsatisfiable theatre that cost a manual override. Same class of
narrowing as the two 2026-07-23 beats, next sub-cases.

## The defect (reproduced first, per debug protocol)

Probed the live hook with a throwaway session key before any edit (flag CONTENT: absent/code/visual):

| write target | branch | before |
|---|---|---|
| `eval/fixtures/x.html` (cwd-RELATIVE, no leading `/`) | Bash/Write | **visual** |
| `Foo.test.tsx` / `Bar.spec.tsx` (visual-ext test probe) | Write | **visual** |
| `/tmp/x.html`, `/private/tmp/x.html` | Write | **visual** |

Key finding: EXEMPT_PATHS already lists the SUBSTRING `/eval/`, which exempts an ABSOLUTE fixture
path but MISSES a cwd-relative one - a bash `sed -i ... eval/fixtures/x.html` from the project dir
names `eval/fixtures/...` with no leading slash, so `"/eval/"` (slash-eval-slash) does not match.
`.test.ts` already armed only `code` (never visual), so the Stop-gate firings came from the
visual-ext test files and the relative eval `.html`. The Stop gate only blocks on flag=="visual", so
the whole fix is arm-side: keep the flag from ever becoming "visual" for these targets.

## The fix (a precision carve-out on the visual-arm classifier, applied to the write TARGET)

Three anchored predicates, wired into the two lowest-level classifier functions so BOTH the Write
branch and the Bash `_visual_write_target` inherit them:

- `_EVAL_DATA_RE = (^|/)eval/(fixtures|corpus)/` -> `is_exempt` (arm NOTHING, matching the existing
  `/eval/` behavior). Segment-anchored on purpose (only fixtures//corpus/, not a bare `eval/`), so a
  real product route `src/eval/Calculator.tsx` still arms and a substring look-alike `preeval/
  fixtures/` still arms - a naive `"eval/fixtures/" in path` would wrongly exempt the latter.
- `_TEST_FILE_RE = \.(test|spec)\.[A-Za-z0-9]+$` on the basename -> `is_visual_file` declassify.
  A test probe stays a CODE file (is_code_file unaffected), so it arms "code" ("run its tests"),
  never a screenshot. `.test.ts` already armed code; this catches the visual-ext siblings.
- `_is_temp_target` -> `is_visual_file` declassify. A DIRECT scratch drop (immediate parent IS the
  temp root) declassifies visual->code; a nested path keeps arming visual (see the Codex fold).

**Why declassify (visual->code) for test/tmp, but full-exempt for eval:** the task ask is "must NOT
arm the VISUAL gate", not "arm nothing". eval fixtures are DATA the scanner reads and already had a
full-exempt precedent (`/eval/`), so they arm nothing. Test files and tmp scratch are still code you
verify by RUNNING, so they arm "code" - which never blocks the Stop gate and is the prefer-FP
direction ([[feedback_hooks_prefer_false_positives]]).

## The regression I introduced, and the sibling suite that caught it

First cut put `_is_temp_target` in `is_exempt` (arm NOTHING for all of /tmp). That broke
test-nudge-debounce Case D-A (58->3 fail), which edits `/tmp/fake-project/src/file.ts` as a
test-sandbox stand-in and expects it to arm "code" + nudge. Isolated it against HEAD (HEAD 58/0, mine
3 fail) to prove I caused it, not a pre-existing gap. Root cause: full-exempt is BROADER than the ask
- the spec says tmp must not arm VISUAL, and a /tmp code file should still arm code like any code
edit. Fold: moved tmp from `is_exempt` to the `is_visual_file` declassify (visual->code), alongside
the test-file rule. Case D-A green again.

## Codex cross-model review - 2 rounds, 1 recall finding folded

Round 1 (codex-cli 0.142.5, 67s): cleared the eval anchor (rejects `preeval/fixtures/`), the
basename-scoped test rule, and quoting (0 literal single-quotes in the `python3 -c` body, syntax
passes). Flagged ONE recall loss: `_is_temp_target` prefix-matched the WHOLE temp subtree, so a real
repo checked out under temp (`/tmp/my-app/src/components/Foo.tsx`, `/var/folders/.../repo/app/
page.tsx`) would arm only code and MISS the screenshot gate - a prefer-FP violation.

Fold: narrowed `_is_temp_target` to a DIRECT scratch drop - True only when
`os.path.dirname(normpath(path))` is exactly a root in `_TMP_DIRECT_ROOTS = {/tmp, /private/tmp}` plus
`$TMPDIR/$TEMP/$TMP`. The bare `/var/folders/` is deliberately NOT a root (its direct children are
per-user hash dirs; the real macOS temp dir arrives as `$TMPDIR` via env). A nested product path is
no longer a direct child, so it keeps arming visual. Env-only reads (no `tempfile.gettempdir()`,
which would probe the filesystem for writability on every tool call).

Round 2 (21s) confirmed: no recall loss for nested repos, direct scratch drops still declassify, no
quoting hazard. It named one ACCEPTED RESIDUAL by design: a visual file placed DIRECTLY in a temp
root (`/tmp/App.tsx`, `$TMPDIR/index.html`) declassifies to code. That is exactly the spec (c) ask
(a temp-dir path must not arm visual) and its literal example `/tmp/x.html`; real product UI lives
NESTED in a repo (src//app//components/), never loose in a temp root, so real-world risk is
negligible. Pinned as an explicit test row so it stays deliberate, not accidental.

## Before/after (live probe through the ~/.claude symlink the running session invokes)

| class | example | before | after |
|---|---|---|---|
| relative eval fixture (THE reported vector) | `sed -i ... eval/fixtures/x.html` | visual | **absent** |
| relative eval corpus | `tee eval/corpus/x.html` | visual | **absent** |
| visual-ext test probe | `Bar.spec.tsx`, `Foo.test.tsx` | visual | **code** |
| direct temp scratch | `/tmp/x.html`, `$TMPDIR/out.html` | visual | **code** |
| NESTED product repo under temp | `/tmp/my-app/src/App.tsx` | visual | **visual** (recall kept) |
| real product UI (control) | `src/components/Foo.tsx`, `tee src/App.css` | visual | **visual** |
| anchor look-alike (control) | `preeval/fixtures/x.html` | visual | **visual** |
| tmp prefix look-alike (control) | `/home/x/mytmp/App.tsx` | visual | **visual** |

The live hook still RUNS (emits valid JSON, arms correctly) - proven end-to-end, not just saved.

## Verification (proven, not claimed)

- Baseline green FIRST, then after. All 6 suites, zero failures: **test-verify-before-done 145->168**
  (+23 rows, both directions negative-controlled), test-verify-visual-gate 31, test-verify-session-
  isolation 11, test-nudge-debounce 58, test-bash-guard-commit 148, test-validation-guards 70.
- `bash -n` clean and a literal-single-quote count of **0** inside the `python3 -c` payload after
  every edit (the class that bricked this live hook twice on 2026-07-18).
- HEAD-vs-mine isolation proved `src/eval/Calculator.tsx` exemption is the PRE-EXISTING `/eval/`
  substring (clear on both), not my anchored regex - not a regression, out of scope.
- 2 rounds of Codex cross-model review; the 1 in-scope recall finding folded and re-verified.

## No other arm path weakened

Only the two arm-side files changed; `verify-before-done-stop.sh` is UNTOUCHED (the fix is entirely
arm-side - the flag never becomes "visual" for these targets, so the Stop gate never fires on them;
a real UI change still arms visual and the gate still fires). The deploy/`project_has_ui` arming and
the reference-narrowed `_visual_write_target` logic are unchanged; `_visual_write_target` simply
calls the now-more-precise `is_visual_file`, which is the intended consistent inheritance.

## Self-analysis

Failure mode: I reached for the BROADEST exemption (full-exempt all of /tmp) instead of the
NARROWEST that satisfies the ask ("must not arm the VISUAL gate"). Full-exempt was one keystroke
simpler but semantically wrong - it stopped a /tmp code file from arming code at all, which a sibling
suite immediately caught. This is the same lesson the 2026-07-23 reference beat pinned: minimal in
CONCEPT, not keystrokes; state the exact ask before coding. The ask was visual-vs-code, so the fix
belonged in the visual classifier, not the blanket exemption. The process note that worked: I ran the
FULL sibling suite set (not just my own), isolated the failure against HEAD before theorizing, and
mutation-proved the eval anchor rejects the `preeval/` look-alike - which is what kept me honest.

## Files touched

- claude/hooks/verify-before-done.sh (`_EVAL_DATA_RE`, `_TEST_FILE_RE`, `_ENV_TMP`,
  `_TMP_DIRECT_ROOTS`, `_is_test_file`, `_is_temp_target`; eval-relative + tmp into `is_exempt` /
  `is_visual_file`; test-infix into `is_visual_file`)
- claude/hooks/test-verify-before-done.sh (+23 flag-CONTENT rows: the 3 carve-out classes on Write
  and Bash branches, the anchor/prefix look-alike controls, the real-UI controls, the Case D-A
  no-over-exempt guard, the Codex nested-repo recall guards, and the accepted-residual pin)
