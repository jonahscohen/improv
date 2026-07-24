---
name: verify-before-done visual arm narrowed to genuine WRITE TARGETS (the reference FP)
description: A Bash command that merely REFERENCED a .css/.tsx (a codemod arg, a cp read source) armed the "visual" flag and falsely demanded a screenshot; narrowed to genuine write targets after a Codex review caught 5 recall regressions in the first cut
type: project
relates_to: [session_2026-07-18_verify-hook-dequoted-triggers-fp-fix.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: Mac
source: session
verified: tests (5 suites green; test-verify-before-done 102->145 with +43 negative-controlled rows) + live probes incl. the real repo + 6 mutation tests + 3 rounds of Codex review folded
confidence: high
---

Jonah, 2026-07-23: the recurring false positive at the END of research/refactor sessions - a shell
command that merely MENTIONS a visual filename armed "visual", and the Stop gate
(verify-before-done-stop.sh) then demanded a screenshot even though no UI changed.

## The defect (reproduced first, per debug protocol)

Two independent over-arm sites in the Bash arm block, both reproduced against the live hook
before any edit (probe prints the flag CONTENT: absent / code / visual):

| command | branch | before |
|---|---|---|
| `npx jscodeshift -t codemod.js src/Button.tsx` | DEPLOY | **visual** |
| `cp src/App.tsx src/App.tsx.bak` | WRITE | **visual** |
| `cp src/App.tsx /tmp/x.txt` | WRITE | **visual** |

1. **DEPLOY branch** used `_names_visual = any(is_visual_file(t) for t in _all_files)` over EVERY
   file-ish token, so a codemod/tool that merely NAMED a `.tsx` as an argument armed visual.
2. **WRITE branch** armed visual on `any(is_visual_file(t) for t in file_tokens)`, treating a cp
   READ SOURCE identically to a write target (the inline comment admitted the over-arm).

`npx tsc --noEmit src/App.tsx` was already absent (is_verification_only short-circuits at
`--noEmit`/`npx tsc` before the deploy branch), so it was never part of the FP.

## The fix

New `_visual_write_target(s)` helper: classify "visual" only when a visual file is a genuine
WRITE TARGET, and wire it into BOTH branches, replacing `_names_visual` (deploy) and
`any(is_visual_file(...))` (write).

**Why:** a file that is only READ or only NAMED renders nothing new, so demanding a screenshot for
it is unsatisfiable theatre - the boy-who-cried-wolf threshold in
[[feedback_hooks_prefer_false_positives]]. Declining to arm VISUAL on a pure reference is not
under-arming a write: the WRITE branch still arms (as "code") whenever a code file is referenced,
so prefer-FP is preserved. Only the visual-vs-code LABEL is narrowed.

**How** (the final, simplified rule):

> Among write-verb operands the ONLY reference is a **cp READ SOURCE**, because cp alone leaves an
> operand untouched. Everything else a write verb names is CHANGED.

- (a) the token after a dash-guarded `>` / `>>` redirect
- (b) any file operand of a SEGMENT carrying a write verb - except a plain `cp`, where only the
  destination (trailing operand) is written. `sed -i` and `tee` edit EVERY operand in place; `mv`
  DESTROYS its source as well as creating its destination, so both ends of an mv count.
- (c) any file operand of a SEGMENT carrying an in-place write FLAG (`--write`/`--fix`/`--in-place`)

Write VERBS stay SUBSTRING matches, so `bash -lc "cp ..."`, `\cp`, `gsed -i` and `git mv` all still
count - that is the recall the 2026-07-18 de-quote attempt lost.

## Before/after, by class (live probe, 30 cases green)

| class | example | before | after |
|---|---|---|---|
| visual REFERENCE (deploy arg) | `npx <codemod> src/Button.tsx` (non-UI proj) | visual | **code** |
| visual REFERENCE (cp read source) | `cp src/App.tsx src/App.tsx.bak` | visual | **code** |
| visual REFERENCE (cp read source) | `cp src/App.tsx /tmp/x.txt` | visual | **code** |
| read-only naming a .css | `grep`/`sed -n`/`wc` on app.css | absent | absent |
| real visual write | `sed -i ... src/app.css`, `tee src/App.tsx` | visual | visual |
| chained write + build | `sed -i ...app.css && npm run build` (non-UI) | visual | visual |
| real UI build | `npm run build` (react dep) | visual | visual |
| non-UI build | `npm run build` (CLI lib) | code | code |
| wrapped/escaped verbs | `bash -lc "cp ...App.tsx"`, `\cp`, `gsed -i` | visual | visual |
| arrow FP guard (2026-07-18) | `printf "%s -> %s" a.tsx b.tsx`, `2>&1` | absent | absent |

> **CORRECTION (lead review, same day).** The first row above originally read
> "`npx <codemod> src/Button.tsx` (non-UI proj) -> code" with no qualifier, which OVERSTATED
> the result. As first shipped it held only where a `package.json` existed AND read non-UI.
> In a `package.json`-LESS directory the deploy branch still armed visual, because
> `project_has_ui` failed open - see the next section, which closes that.

`mv src/Old.tsx src/New.tsx` (rename) stays **visual**, deliberately: a component rename changes
what the app imports and can absolutely change UI, and prefer-FP favours arming.

## The Codex review - 5 findings, ALL recall regressions, all folded

The first cut scored only the TRAILING file operand of a write-verb segment and captured a redirect
target with a bare `\S+`. Codex (gpt-5.x, high effort) probed the live hook and found 5 FALSE
NEGATIVES - the direction prefer-FP forbids outright. Every one was confirmed against the live hook
before folding:

1. `npx prettier --write src/App.tsx` -> code. An in-place write FLAG rewrites the file it names.
2. `sed -i s/a/b/ src/app.css src/foo.ts` and `tee src/App.tsx notes.txt` -> code. `sed -i`/`tee`
   edit EVERY operand, not just the last.
3. `mv src/App.tsx src/App.ts` / `git mv ...` -> code. mv DESTROYS its source.
4. `node gen.js > src/out.css; true`, `(node gen.js > src/out.css)`, `> "src/out file.css"` -> code.
   `(\S+)` captured the punctuation (`src/out.css;`, `src/out.css)`) or truncated the quoted target.
5. `tee /dev/null >(cat > src/App.tsx)` -> code. The inner redirect was hidden by the procsub.

**The fold SIMPLIFIED rather than patching each case** - the exact 2026-07-18 lesson
([[session_2026-07-18_verify-hook-dequoted-triggers-fp-fix]]). Dropping the "last file operand"
heuristic for "the only reference is a cp read source" fixed findings 2 and 3 outright; widening the
redirect capture to a quoted-or-bare token stopping at shell punctuation fixed 4 and 5; the write-flag
list fixed 1. Round-2 Codex confirmed all five fixed with no new regressions in either direction.

Also hardened while in there: the redirect lookbehind `(?<!-)` -> `(?<![->])`, so a prose `-->` arrow
cannot be read as a redirect (the widened capture would otherwise have matched its second `>`).

## Follow-up in the same unit: project_has_ui failed OPEN and dominated the fix

Lead review, 2026-07-23: the deploy branch is
`"visual" if (_visual_write_target(cmd) or project_has_ui(...))`. `project_has_ui` walked up 6
parent dirs for a `package.json` and, finding none, fell out of the loop to a bare `return True`.
So EVERY `package.json`-less directory was classified a UI project, and because it is OR-ed, the
new write-target check was IRRELEVANT there. Jonah reported symptom was still live.

**Reproduced** with a clean empty-dir control (not `/tmp`, which carries stray `.css`/`.html`):

| command | cwd | before |
|---|---|---|
| `npx jscodeshift -t codemod.js src/Button.js` | empty dir | **visual** |
| `npx jscodeshift -t codemod.js src/Button.tsx` | empty dir | **visual** |
| `make all` / `npm run build` | empty dir | **visual** |

The `.js` row is decisive: no visual file named, no write verb, no redirect, so
`_visual_write_target` is provably False and only `project_has_ui` could have armed it.
Direct call confirmed `project_has_ui(<empty dir>) == True`.

**Why not simply `return False`:** a real UI project with NO `package.json` - a plain static
HTML/CSS site, which Jonah has (the improv marketing and reference sites) - would stop arming
visual on a build. That is a recall loss, the direction prefer-FP forbids. A mutation test proves
the trap is caught: flipping the fallthrough to a bare `return False` fails exactly the 5
static-site/no-cwd recall rows.

**Why a filesystem scan is safe HERE** (the documented objection is that the hook must NOT scan
for `.css`/`.html`, because sidecoach ships fixtures it never renders): that objection is scoped to
projects that HAVE a `package.json`. Verified against the repo - sidecoach has
`./sidecoach/package.json`, and all 209 of its eval/pages HTML files sit UNDER it, so sidecoach is
decided by deps/scripts and can never reach this fallback. Only a `package.json`-less tree gets
here, and there an `.html` IS the project.

**How:** `_has_rendered_html(start)` - a bounded BFS (depth 3, skips hidden dirs and
`node_modules`, 400-entry cap) for an `.html`/`.htm`. An unreadable dir or a cap-hit returns True
(cannot tell -> over-fire, the stance this module already documents). `project_has_ui` now ends:

    if not start: return True          # no cwd at all -> still know nothing -> over-fire
    return _has_rendered_html(os.path.abspath(start))

| cwd | before | after |
|---|---|---|
| empty dir (no package.json) | visual | **code** |
| non-UI `package.json` | code | code |
| UI `package.json` | visual | visual |
| static site, no `package.json`, real `.html` | visual | **visual** (recall kept) |
| no cwd at all | visual | visual (cannot tell) |

Real visual WRITES still arm visual in an empty dir (`sed -i ...app.css && npm run build`,
`npx prettier --write src/App.tsx`) - the write-target check is no longer masked by the OR.

**Self-found recall bug during this work:** the first cut used depth 2, which is tighter than real
static layouts and missed `site/src/pages/index.html` (armed code - a false negative). Found by
probing the scan directly rather than trusting the suite, and widened to depth 3. Residual: html
deeper than 3 levels in a `package.json`-less tree still reads as non-UI. Robustness probed
explicitly - symlink loop terminates in 0.09s via the entry cap, broken symlinks and unreadable
dirs return without raising. A traceback here would break the hook on EVERY tool call, so that
class was tested before shipping.

**Validated against the REAL repo** (improv has no root `package.json`, so it takes this path):
`improv` root -> visual (correct: `reference/index.html` at depth 1 is a genuine static site);
`improv/sidecoach` -> code (its `package.json` reads non-UI, and the 209 eval fixtures correctly
did NOT produce a UI verdict - the documented objection is fully handled); `improv/claude/hooks`
-> code. Scan cost 0.087s.

**Codex round 3 - 1 confirmed finding, ACCEPTED as a justified residual.** Codex disproved 4 of 5
probe areas (depth-3 html, cap-hit over-fire, robustness incl. symlink loop, quoting all clean) and
confirmed one FN: a static site whose ONLY html lives in a hidden dir (`.site/index.html`) or in
`node_modules` reads as non-UI. Not fixed, with evidence: removing either skip makes ANY directory
containing a `.git` blow the 400-entry cap and return visual - proven with a 504-entry `.git`
fixture, `code` with the skips vs `visual` without. That re-neuters the exact fallthrough bug this
section fixes. The scenarios are also not real: `node_modules` html is a dependency shipping its
own docs, not this project UI, and a `package.json`-less tree containing `node_modules` is
self-contradictory; hidden dirs are tooling/cache by convention, and the framework build-output
hidden dirs that DO hold real UI (`.next`, `.nuxt`, `.svelte-kit`, `.output`) belong to node
projects that always have a `package.json`, so they are decided by deps and never reach this
fallback. Trading a real fix for an unreachable case is the wrong direction.

## Accepted residuals (pre-existing, NOT introduced here - proven against HEAD)

Round-2 Codex reported 3 more false negatives. All three probe IDENTICALLY (`absent`) on the
ORIGINAL hook at HEAD and on the fixed one, so they are pre-existing gaps in the hook ENTRY ROUTING
(which commands reach the arm logic at all), not regressions from this change - this change only
affects the visual-vs-code LABEL once a command reaches an arm branch.

- `prettier --write src/App.tsx` with no `npx` prefix: matches no deploy indicator, no write verb,
  no redirect, so it never reaches the arm logic.
- `npx eslint --fix` / `npx stylelint --fix`: short-circuited by `is_verification_only` before the
  arm logic, even though `--fix` genuinely mutates.
- `node gen.js>src/out.css` (no space): `_has_redirect` requires a space after `>`.

**Deliberately NOT fixed in this unit.** They are UNDER-arming, a different defect class from this
unit remit, and fixing them EXPANDS what arms - the opposite direction of the noise Jonah reported.
The no-space redirect in particular was already litigated on 2026-07-18, where a Codex review
REJECTED the bare `>` fix for newly matching `2>&1` and `>(procsub)`. Logged as a follow-up unit,
following the precedent of the memory-nudge.sh follow-up in the 2026-07-18 beat.

## Verification (proven, not claimed)

- Baseline green FIRST (102 / 15 / 11), then after: **test-verify-before-done 102 -> 132** (+30 rows),
  test-verify-visual-gate 15, test-verify-session-isolation 11, test-nudge-debounce 58,
  test-bash-guard-commit 148. Zero failures.
- 30-case live probe covering every class in the table above, plus all 5 Codex cases re-probed after
  the fold.
- **3-way mutation test** proving the new rows are negative-controlled, not decorative: helper forced
  True (the old over-arming) -> 10 rows fail; forced False (total recall loss) -> 19 rows fail;
  cp-read-source exclusion reverted -> exactly the 2 cp FP rows fail.
- `bash -n` clean and a literal-single-quote count of **0** inside the `python3 -c` payload after
  every edit (the class that bricked the live hook twice on 2026-07-18).
- 2 rounds of Codex cross-model review; all 5 in-scope findings folded and re-verified.

## Self-analysis

**I repeated the exact failure mode this hook file has a documented history of.** The 2026-07-18 beat
is explicit: a Codex review rejected an over-engineered fix that traded one FP for several recall
regressions, and the lesson recorded was "reach for the minimal surgical change and let prefer-FP
bias the design." I read that beat before starting, wrote "minimal" in my plan, and then still
invented a "LAST file operand is the write target" heuristic that produced 5 false negatives.

Why it happened: I optimised for a rule that was easy to IMPLEMENT (take the trailing token) instead
of one that was true to the SEMANTICS of each verb. I never asked the actual question - "which
operands does this verb change?" - which has a short, exact answer: sed -i and tee change all of
them, mv changes both ends, cp alone leaves its sources untouched. That correct rule is SIMPLER than
the heuristic I shipped, not more complex. The signal I missed: when my rule needed a special case to
strip `<` sources, that was evidence I was modelling positions rather than semantics.

The deeper lesson beyond "keep it minimal": minimal means minimal in CONCEPT, not minimal in
keystrokes. A positional heuristic feels smaller than a per-verb rule but is actually a bigger,
leakier abstraction. Pinned for next time on this file: state the semantic rule in one sentence
before writing the regex, and if the sentence needs an "except" clause per verb, encode the verbs.

Process note that worked: I probed the live hook before editing, mutation-tested the new rows in both
directions, and probed HEAD to separate my regressions from pre-existing gaps. That last step is what
kept the 3 round-2 findings from being misattributed to this change and pulling the unit out of scope.

## Files touched

- claude/hooks/verify-before-done.sh (`_visual_write_target` + `write_flag_indicators`; deploy branch
  `_names_visual` -> helper; write branch visual-upgrade -> helper; dead `_all_tokens`/`_all_files`
  pre-block removed)
- claude/hooks/test-verify-before-done.sh (+30 flag-CONTENT rows: the reference FPs, the recall
  negative controls, all 5 Codex cases, and the arrow/fd-dup guards)
