---
name: Lead verification of the visual-arm narrowing + the project_has_ui fail-open gap it does not reach
description: Independently re-verified the verify-hook unit (suites green, recall intact), then found that project_has_ui returns True for any package.json-less dir, so the deploy branch still arms visual on every npx/make command - the reference fix is OR-dominated and does not resolve Jonah's reported FP
type: project
relates_to: [session_2026-07-23_verify-visual-arm-reference-narrowed.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (5 suites re-run green by the lead) + live probe against the real hook with a clean empty-dir control
confidence: high
---

Jonah, 2026-07-23. Lead-side independent verification of the `verify-hook` teammate unit
([[session_2026-07-23_verify-visual-arm-reference-narrowed]]), plus a gap that unit does not reach.

## What I independently confirmed (the unit is sound)

Re-ran everything myself rather than trusting the teammate report:

- `test-verify-before-done.sh` **132 passed / 0 failed** (baseline 102, so +30 rows),
  `test-verify-visual-gate.sh` 15/0, `test-verify-session-isolation.sh` 11/0,
  `test-nudge-debounce.sh` 58/0, `test-bash-guard-commit.sh` 148/0. No cross-suite regression.
- `bash -n` clean; **0 literal single-quotes** inside the `python3 -c` payload (the class that
  bricked this live hook twice on 2026-07-18).
- Live probe on the real hook, throwaway session key. Reference class narrowed as specced:
  `cp src/App.tsx src/App.tsx.bak` -> `code` (was `visual`), `grep -rn ... app.css` -> `absent`.
  Recall fully intact: `sed -i ... src/app.css`, `tee src/App.tsx notes.txt`,
  `npx prettier --write src/App.tsx`, `mv src/Old.tsx src/New.tsx`,
  `node gen.js > src/out.css; true` all still `visual`.

The teammate's Codex round (5 folded false negatives) and its per-verb semantic rule are good work.

## The gap: `project_has_ui` fail-opens, and it OR-dominates the fix

The deploy branch is `arm_and_report("visual" if (_visual_write_target(cmd) or project_has_ui(...)))`.
`project_has_ui` walks up to 6 parent dirs for a `package.json`; when it finds none it falls out of
the loop to a bare `return True`.

**Why this matters:** the fallthrough means any `package.json`-less directory is classified as a UI
project. Since it is OR'd, `_visual_write_target` is irrelevant on that branch whenever
`project_has_ui` is True - which is *always*, absent a nearby non-UI `package.json`.

Proven against the real hook with a clean empty-dir control (not `/tmp`, which carries stray
`.css`/`.html` and is a poor control):

| command | cwd | flag |
|---|---|---|
| `npx jscodeshift -t codemod.js src/Button.tsx` | empty dir | **visual** |
| `npx jscodeshift -t codemod.js src/Button.js` | empty dir | **visual** |

The `.js` row is the decisive one: no visual file is named anywhere, no write verb, no redirect - so
`_visual_write_target` is provably False and only `project_has_ui` can have armed it. Direct call
confirms: `project_has_ui(<empty dir>) = True`.

**Consequence:** Jonah's reported symptom - the stop-gate false-firing at the end of research/refactor
sessions - is NOT resolved by the reference narrowing alone. Any `npx `/`make `/`npm run build`/
`node build` command still arms `visual` on the deploy branch. The unit fixed the literal ask
(a mere reference must not arm visual) while the dominant predicate went untouched.

## RESOLVED (same day): the fallthrough now delegates to a rendered-HTML check

The teammate closed this. `project_has_ui` no longer bare-`return True`s on a missing package.json:
with no cwd at all it still returns True (nothing is knowable -> keep over-firing), but with a real
directory it defers to a new bounded `_has_rendered_html(start)`.

**Why this does NOT reintroduce the fixture-scan trap** (the documented reason the deps rule exists):
that trap is scoped to trees that HAVE a package.json. Sidecoach's 209 eval/pages HTML files all sit
UNDER `sidecoach/package.json`, so sidecoach is decided by deps/scripts and never reaches the
fallback. Only a package.json-less tree gets there, and in one an `.html` genuinely IS the project -
a plain static site with no build tooling, exactly the UI that must keep arming.

Bounded so it can run on any Bash call reaching the deploy branch: depth 3, skips hidden dirs and
node_modules, 400-entry cap. Unreadable dir or a cap-hit scan returns True (cannot tell -> over-fire),
which keeps the prefer-FP stance.

Verified by me independently on the real hook (temp fixtures: an empty dir, a package.json-less
static site with `public/index.html`, and a CLI-lib package.json):

| command | cwd | before | after |
|---|---|---|---|
| `npx jscodeshift -t cm.js src/Button.js` | empty | visual | **code** |
| `npx jscodeshift -t cm.js src/Button.tsx` | empty | visual | **code** |
| `npx jscodeshift -t cm.js src/Button.tsx` | cli-lib | visual | **code** |
| `npm run build` | static site (no package.json) | visual | **visual** (recall kept) |
| `npm run build` | empty | visual | **code** |
| `sed -i s/a/b/ src/app.css` | cli-lib | visual | **visual** (write target) |

The static-site row is the one that mattered: it is the recall case a naive `return False` would have
lost, and it survives. Suites after: test-verify-before-done **145** (132 -> 145, +13), visual-gate 15,
session-isolation 11, nudge-debounce 58, bash-guard-commit 148. All zero failures, re-run by me.

**Jonah's reported symptom is now actually fixed**, which the reference narrowing alone did not do.

## Unit 4: Stop-gate working-tree corroboration - lead-verified

After the quoted-mention decline ([[decision_verify_hook_quoted_mention_arming]]) I dispatched the
safer alternative that beat proposed, since Jonah's complaint was the STOP gate firing, not arming
per se. `verify-before-done-stop.sh` now corroborates an armed "visual" flag against the working
tree and withholds the demand ONLY when git proves there is no visual file to screenshot. Arming and
all visual recall are untouched - this adds a second piece of evidence rather than removing the first.

Checked the one thing that could silently fail it OPEN: the stop-side `VISUAL_EXTS` must be a
superset of the arm side, or a real visual change would be downgraded. Extracted both sets and
diffed them - identical 14 extensions, arm-only set empty. Safe.

Six behavioral controls, run by me against the real hook on temp git fixtures:

| case | result |
|---|---|
| clean repo, zero visual files | **allow** (the fix) |
| untracked `.css` present | BLOCK |
| NEW never-added dir containing `Hero.tsx` | BLOCK |
| not a git repo at all | BLOCK |
| no cwd supplied | BLOCK |
| cwd does not exist | BLOCK |

The never-added-directory row is the one I insisted on: plain `--porcelain` collapses a new dir to a
single `?? newdir/` record and would hide the `.tsx`, failing open on exactly the case the gate
exists for. The implementation uses `--untracked-files=all` so it expands, plus `-z` (no C-quoting,
so a filename with a space cannot split into a wrong extension), `--ignore-submodules=none`, and a
directory entry blocks because it cannot be enumerated. Every uncertainty returns block.

test-verify-visual-gate 15 -> **31** (+16 rows). Full set after unit 4: 145 / 31 / 11.

## Second, separate FP class observed live

The hook armed `visual` on my own read-only diagnostic probe, because the probe *contained*
`sed -i` / `tee` / `> ` as quoted ARGUMENTS. Same class the 2026-07-18 beat logged against
`memory-nudge.sh` ("my PROBE commands carry write-command strings as ARGS"). Note this is genuinely
hard to fix: Codex already REJECTED de-quoting on 2026-07-18 because it lost `bash -lc "cp ..."`
recall. Recording it as a known class, not dispatching a fix.

## Also noticed

Nine `~/.claude/.needs-verification.<session>` flag files are on disk, several stale from dead
sessions. Session-keying (2026-07-18) fixed cross-session leakage but nothing reaps the files.
Cosmetic, no correctness impact - the Stop gate only reads the current session key.

## Self-analysis

I reported the two teammates as failed/dead on the strength of a single `idle_notification`, while
two contradicting signals were already in hand: both processes alive with growing elapsed time
(`S+`, 16min), and Jonah telling me directly "teammates are working." A usage limit is an
account-level pause, not a crash. I then ran their suites and drafted a takeover of their live files,
which would have clobbered in-flight work. The failure mode is the documented one on this repo:
trusting a notification instead of verifying state. Pinned: a teammate is dead only when `ps` says
the pid is gone, never on a notification alone.

The good process note: I did not accept the teammate's beat at face value, and probing its claim with
a proper control is what surfaced the `project_has_ui` fallthrough that the whole unit sits on top of.

## Files touched

- .claude/memory/session_2026-07-23_verify-arm-lead-verification-project-has-ui-gap.md (this beat; the only write)
