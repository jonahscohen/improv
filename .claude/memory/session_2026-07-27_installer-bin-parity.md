---
name: bin/* and reverse-wiring parity - two new mechanical checks, two real defects found
description: Closed the two installer coverage classes nobody owned - bin/* had zero disk-vs-installer reconciliation and settings parity only ran one direction. Both new suites found a real shipped defect on their first run against the real repo.
type: project
relates_to: [session_2026-07-27_installer-coverage-collision-halt.md, session_2026-07-23_hook-registry-guard-escape-fixed.md]
author_human: Jonah
source: session
verified: 17/0 and 38/0 negative-controlled self-tests; five baseline suites unchanged before and after; Codex (gpt-5.5) review, 9 findings, all folded and re-verified
confidence: high
---

# bin/* parity and the reverse wiring direction (2026-07-27)

> **LEAD VERIFIED 2026-07-27.** Re-run from the lead session rather than trusted:
> `test-bin-parity.sh` 17 passed / 0 failed self-test, exit 1 on real-repo findings;
> `test-settings-wire-parity.sh` 18 passed / 0 failed self-test, exit 1. Both defects
> reproduced by hand: `question-enforcement.sh` ships from the `question-discipline`
> cluster at install.sh:680 and appears only in browser-tree.json with no settings wiring;
> install.sh:365 promises `bin/transcribe` while `bin/` holds only `ampersand`,
> `claude-teams-launcher.sh` and `tilt-lab-launcher.sh`.
>
> A suite that exits 1 against the real repo on its FIRST run, with a green
> negative-controlled self-test behind it, is the strongest shape a new check can have -
> it proves the check discriminates before anyone has to trust its verdict.
>
> **Verification hazard confirmed live, worth carrying forward.** During this wave
> `test-hook-registry.sh` read **51/1** once, then 52/0 on three immediate re-runs, with no
> `^FAIL` line in the failing run and the suite file itself unmodified since 2026-07-23.
> It is the same mid-flight artifact the 2026-07-23 beat recorded: a teammate rewriting
> `browser-tree.json` underneath a suite that is reading it. The rule this implies for any
> lead verification during a live wave: a single red row against a tree that another agent
> is actively writing is not evidence of a regression until it reproduces on a quiescent
> tree. Re-run before believing it, and prefer verifying after the writer has stood down.
>
> All three fixes (drop question-enforcement.sh from both install.sh and browser-tree.json,
> correct the bin/transcribe prose, add the trailing boundary to the unbounded wiring regex
> in `test-settings-deploy-parity.sh`) were sequenced to the `ampersand` teammate, which
> owns install.sh, to be picked up after its data-loss patch. Teammate stood down.

Collaborator: Jonah. This is the uncontended half of the installer coverage work.
The contended half (install.sh, browser-tree.json, hook-registry-guard.sh, the
`hook_data_files` table, the consolidate and tilt-lab skills) belongs to the
`ampersand` teammate, per the ruling recorded in
`session_2026-07-27_installer-coverage-collision-halt.md`. **Nothing in this unit
edits any file that teammate owns. Both deliverables are new files.**

## Verification baseline (Team Rule 9)

Re-taken at HEAD `e42b9a57` at the start of this unit, and again at the end.
Identical both times, so the two new files changed nothing:

| suite | before | after |
|---|---|---|
| test-hook-registry.sh | 52 passed, 0 failed | 52 passed, 0 failed |
| test-installer-manifest.sh | PASS | PASS |
| test-component-browser.sh | 139 passed, 0 failed | 139 passed, 0 failed |
| test-install-hook-deploy.sh | 26 passed, 0 failed | 26 passed, 0 failed |
| test-settings-deploy-parity.sh | ALL PARITY CHECKS PASSED | ALL PARITY CHECKS PASSED |

`hook-registry-guard.sh --audit` also still exits 0. Both new files are `test-*`,
which the guard's `_is_excluded` skips, so they need no browser-tree.json or
install.sh registration - which is what made this unit possible without touching a
contended file.

### A transient red, and why it was not real (06:57)

A third baseline re-take, run while `ampersand` was still working in the tree, showed
`test-hook-registry.sh` at **51 passed, 1 failed**. It was not a regression:

- grepping the same run for `^FAIL` returned nothing, so the failing row did not
  survive to the end of the run
- three consecutive re-runs immediately after: **52/0, 52/0, 52/0**
- `test-hook-registry.sh` itself is dated **2026-07-23** and was not modified today,
  so the suite was not the variable

This is the same artifact the 2026-07-23 beat recorded ("a suite run went red
mid-flight while a concurrent teammate was rewriting `browser-tree.json`"), and the
same reason that beat added a distinct "cannot tell" exit code. **Standing lesson,
now observed twice: a single red row in a tree with a live concurrent writer is a
reading, not a result. Re-run before reporting it.** The inverse error - re-running
until green and calling that the answer - is guarded against by requiring the re-runs
to be unanimous and the suite file itself to be unchanged.

## The per-class drift audit, carried forward

Measured read-only against HEAD `e42b9a57` before any of the concurrent work landed.
Recorded here so the measurement is not lost with the halted unit.

| class | on disk | deployed at HEAD | delta at HEAD |
|---|---|---|---|
| skills | 18 dirs | 17 | GAP: `consolidate`, `tilt-lab` never deployed (**ampersand's**, closed in their branch) |
| agents | 3 `.md` | 3, via the route-intent.sh special case | none |
| hook data/config | 9 `.json` | 7 | GAP: `grounding-intent.json`, `consolidate-intent.json` never deployed (**ampersand's**, closed by their `hook_data_files` table) |
| bin launchers | 3 | 2 | **no reconciliation existed in either direction - this unit** |
| wirings | settings/app/cluster JSON | forward direction only | **reverse direction unchecked - this unit** |

## What was built

### 1. `claude/hooks/test-bin-parity.sh` (17 assertions, 0 failed)

Reconciles repo-root `bin/` against install.sh in both directions, mirroring
`hook-registry-guard.sh`'s two-sided `_is_managed`.

**Why two-sided:** one direction alone is a half-check that passes while the other
half is broken - the lesson from the sidecoach 2-vs-6 lie. **How:** it re-derives the
answer from the disk and from install.sh's own text on every run, and the fixture
section plants each defect class and asserts it goes red, then registers it properly
and asserts it goes green again. A check that only ever runs against a clean tree
cannot tell you whether it would notice a dirty one.

Five finding classes: `UNREGISTERED-BIN`, `PROSE-ONLY-BIN`, `DANGLING-DEPLOY-REF`,
`STALE-BIN-PROSE`, `STALE-EXCLUSION`. Exit codes 0 clean / 1 real finding /
2 self-test broken / 3 cannot-tell.

**The design call that mattered:** `bin/ampersand` is never deployed - the `~/.zshrc`
shim execs it in place from the checkout, deliberately, so changes ship by `git pull`.
Modelling only "deploy" would have flagged it forever, and a check that is permanently
red on correct code is one people learn to override. So RUN-IN-PLACE is a first-class
registration mode. The carve-out is bounded by its own row: a launcher that is only
*described* is still a finding.

### 2. `claude/hooks/test-settings-wire-parity.sh` (38 assertions, 0 failed)

The exact reverse of `test-settings-deploy-parity.sh`. The forward twin asserts every
hook WIRED in settings.json is DEPLOYED. This asserts every hook DEPLOYED is WIRED,
or is a helper whose reacher shipped alongside it.

**Why the reverse is the more dangerous direction:** the forward failure is loud
(command-not-found on every matching event). The reverse failure is silent - the hook
sits there looking installed and never fires, nothing errors. That silence is the same
shape as the route-intent.json bug (2026-07-26) and the three unpackaged hooks
(2026-07-23). **How:** same per-selection sandbox-install method as the forward twin,
because a static "wired by SOME path" check passes while `--only X` ships it inert.

## Two real defects found, on the first run of each

**1. `question-enforcement.sh` is deployed and wired to nothing.** `--only
config,question-discipline` installs it; no settings.json event references it; it is
in neither `cluster-wirings.json` nor `app-wirings.json`; no hook sources it; no
launchd plist runs it. It is a functional Stop-shaped hook (reads stdin, exits 1 to
block) that has been inert on every machine that installed it.

Evidence it is superseded rather than merely unwired:

| file | created | last touched | wired in cluster-wirings.json |
|---|---|---|---|
| question-enforcement.sh | 2026-05-21 | 2026-05-24 | no |
| multiple-choice-detect-stop.sh | 2026-05-24 | 2026-07-13 | yes (2 entries) |
| multiple-choice-inject-prompt.sh | 2026-05-24 | 2026-07-13 | yes (2 entries) |
| multiple-choice-enforce.sh | 2026-05-24 | 2026-07-13 | no, but sourced by detect-stop |

It was replaced on the very day it was last touched by the multiple-choice trio, which
CLAUDE.md documents as the live enforcement path. CLAUDE.md never mentions
question-enforcement.sh at all. **Recommended fix: stop deploying it** (drop it from
the `question-discipline` list in `cluster_hooks()`), not wire it.

**2. install.sh promises `bin/transcribe`, which does not exist.** The voice-input
component description says it "symlinks bin/transcribe to ~/.claude/transcribe". The
code at install.sh:4678-4679 symlinks `claude/transcribe.sh`. Cosmetic (the install
works), but it is the same FILES-text-overpromises-the-code shape Codex caught on
agent-routing in 2026-07-26.

### Exact patches, for whoever owns install.sh

Both live in install.sh, which this unit must not touch. Handing them over rather than
applying them:

```
# install.sh:365  (voice-input DESCS)
-  ... and symlinks bin/transcribe to ~/.claude/transcribe. ...
+  ... and symlinks claude/transcribe.sh to ~/.claude/transcribe. ...

# install.sh cluster_hooks(), question-discipline
-    question-discipline) echo "multiple-choice-detect-stop.sh multiple-choice-inject-prompt.sh multiple-choice-enforce.sh question-enforcement.sh" ;;
+    question-discipline) echo "multiple-choice-detect-stop.sh multiple-choice-inject-prompt.sh multiple-choice-enforce.sh" ;;
```

The second one also needs `question-enforcement` removed from `hook_owner`/`hooks` in
browser-tree.json, or `hook-registry-guard.sh --audit` will then flag it as tree-only.
Both files are `ampersand`'s right now. Both suites go green once these land.

## Cross-model review (Codex gpt-5.5, real verdict in 200.6s)

Nine findings, all folded, all re-verified. The four that were genuine holes:

1. **`chmod +x` / `[ -f ]` / `[ -x ]` counted as registration.** They name a path
   without shipping or running it, so accepting them would have green-lit the exact
   silent gap the check hunts. Split into `REGISTER_VERBS` (does the installer ship
   it) and `ACT_VERBS` (would this line break under `set -e` if the file vanished) -
   `chmod +x` belongs only to the second. Two new rows hold the line.
2. **The unwired allowlist was global, but the invariant is per-selection.** It would
   have suppressed `detect-session-model.sh` even under a selection shipping neither
   guard that execs it - the defect, not the exemption. The allowlist is now a MAP of
   hook to reacher paths, checked inside each sandbox.
3. **The wiring regex had no trailing boundary**, so
   `~/.claude/hooks/foo.sh.disabled` satisfied a search for `foo.sh` and a
   deliberately-disabled hook read as healthy. Fixed with `(?![A-Za-z0-9_.-])`.
   **The forward twin still carries the unbounded pattern and has the same blind
   spot** - not fixed here, since it is an existing file and this unit is new-files-only.
4. **`claude/docs` counted as reachability.** Documentation describes intent; it does
   not execute. Dropped from the justification search, so a dead hook cannot be
   justified by a paragraph about it.

Also folded: full-path mentions inside comments were graded runtime-breaking
(now stale prose); `BARE_REF` missed `./bin/x` and `"$REPO_DIR"/bin/x` and could match
`my-bin/x`; an "only executables are hooks" comment that did not match extension-based
selection; the default run silently skipping two selections (now says so out loud);
and exit-1 ambiguously meaning "findings" or "findings plus incomplete" (precedence
now documented and a COVERAGE INCOMPLETE block prints).

Codex confirmed the `out="$(f)"; rc=$?` capture, the `VAR=x func` override, and the
unquoted allowlist loop were all correct as written.

**The fold caught two regressions in my own patch**, both via my own controls, which
is the argument for negative controls in one line: reclassifying `chmod +x` broke the
DANGLING row, and I updated the shared regex in two places but not the third
hardcoded copy inside the registration check, so a genuinely deployed file could
report UNREGISTERED. The suite exited 2 (self-test broken) rather than reporting a
confident wrong answer about the real repo.

## Self-analysis

**What went wrong earlier in this session:** I began the original unit without
checking whether the `install.sh` that `git status` already showed as modified was at
rest or being actively written. It was being written, by a teammate who had overrun
into my unit. I caught it before editing anything, but by reflex rather than by
method.

**The mechanical tell, worth reusing:** the in-flight diff's own comments referenced
three files that did not exist yet (`--audit-data`, a `hook_data` key,
`test-hook-data-parity.sh`). **A comment referencing a file that does not exist is a
reliable in-flight signal**, and it costs one `ls` to check. The generalisable rule is
the same one the 2026-07-23 beat named: act on the condition (is someone writing this
right now), not the proxy (git says modified). An mtime that moves twice in a minute
is a writer, not a leftover.

## Files touched

- `claude/hooks/test-bin-parity.sh` (NEW) - bin/ two-direction reconciliation
- `claude/hooks/test-settings-wire-parity.sh` (NEW) - reverse wiring parity
- `.claude/memory/session_2026-07-27_installer-bin-parity.md` (NEW) - this beat
- `.claude/memory/MEMORY.md` - one index line

Deliberately NOT touched: `install.sh`, `claude/hooks/browser-tree.json`,
`hook-registry-guard.sh`, `hook-registry-stop.sh`, `agent-teams-guard.sh`,
`bin/ampersand`, `test-settings-deploy-parity.sh`. Nothing committed.
