---
name: hook-registry gate escape - proven root cause and the disk-sweep fix
description: Three hooks reached main unpackaged because the project-scoped guard never ran for cross-project writes; the Stop gate now sweeps the disk instead of trusting a write-time flag
type: project
relates_to: [session_2026-07-16_hook_registry_guard.md]
author_human: Jonah
machine: Mac
source: session
verified: tests (52 assertions, negative-controlled) / codex-review
confidence: high
---

Three hooks - `task-loop-mandate`, `justify-queue-mandate`, `justify-queue-drain-stop` - were written into this repo, escaped the hook-registry gate entirely, and were committed unpackaged in `f5a34036` and `c2a640c8`. The gate existed and was correctly wired the whole time. This records why it did nothing, and what now makes it unmissable.

## The reproduction

Before touching any code, all three failure paths were reproduced in a sandbox (temp `$HOME`, synthetic repo, live files untouched):

1. A hook written into repo A by a session whose project is repo B: guard emits nothing, flag never armed.
2. `--audit` run with a foreign `CLAUDE_PROJECT_DIR`: globs an empty directory and reports a repo containing three unmanaged hooks as **clean, exit 0**.
3. Stop gate with an unmanaged hook sitting on disk and no flag armed: **exit 0**, silent.

## Proven root cause - PROJECT SCOPE (hypothesis 3)

Evidence is direct, from the Claude Code transcripts rather than inference. All three hooks were created with the **Write** tool - so the `Write|Edit|MultiEdit` matcher was never the problem - by session `702f03ae` whose recorded `cwd` was `/Users/spare3/Documents/Github/ppai`:

- `2026-07-18T00:24:29Z` Write -> `improv/claude/hooks/task-loop-mandate.sh`
- `2026-07-18T00:24:45Z` Write -> `improv/claude/hooks/justify-queue-mandate.sh`
- `2026-07-19T08:26:47Z` Write -> `improv/claude/hooks/justify-queue-drain-stop.sh`

`hook-registry-guard.sh` is project-scoped, wired only in **this** repo's `.claude/settings.json`. A session whose project is ppai never runs improv's PostToolUse hooks at all, no matter which file it writes. So the guard never ran, nothing armed `~/.claude/.unmanaged-hook`, and `hook-registry-stop.sh` returned at its very first line - `[ -f "$FLAG" ] || exit 0` - on every improv stop for the five days the three hooks sat in the tree and got committed.

Second-order confirmation: even if the guard *had* run under that foreign project dir, `REPO_DIR` came from `CLAUDE_PROJECT_DIR`, so it would have looked for `ppai/claude/hooks/browser-tree.json`, found nothing, and taken its deliberate "no tree: not our repo, stay quiet" exit. Two independent layers both fail open on the same input.

### Hypotheses ruled out, with evidence

- **Matcher gap (hypothesis 1)** - not what happened: the transcripts show the `Write` tool, which the matcher covers. It is nonetheless a **real structural hole** - a hook made by `cat >`, a heredoc, `cp`, or `install -m` reaches no PostToolUse matcher, and neither does one arriving by git pull or merge. Closed by the same fix.
- **Flag lifecycle (hypothesis 2)** - not the cause: the flag was never armed at all, so nothing could have cleared or leaked it. The flag being `$HOME`-global rather than session-keyed (the shape of the 2026-07-18 verify-flag bug) turned out to be irrelevant here.
- **Exclusions (hypothesis 4)** - ruled out: none of the three names matches `test-*` or `*-lib`, and `--audit` named all three correctly the moment it was pointed at the right repo.

## The fix

Deliberately preserved: the guard **detects and instructs, it never edits `install.sh` or `browser-tree.json`**. A shell hook cannot pick a correct owning component or write a description worth reading, and auto-registration would ship wrong owners and placeholder text into a browser humans read. The goal was to make detection unmissable, not to make the hook register hooks.

1. **The Stop gate now asks the disk, not the flag.** `hook-registry-stop.sh` runs `--audit` unconditionally on every stop instead of returning early when no flag exists. A hook created by any tool, from any project, by any means is caught before the next stop in this repo can complete. It still blocks only **once** per distinct set, so it can never trap a session.
   **Why:** the flag was a proxy for the real question, and any path that skipped the proxy skipped the gate. **How:** the gate re-derives the answer from `claude/hooks/` at enforcement time; the flag survives as instant write-time feedback but is no longer load-bearing.
2. **`REPO_DIR` resolves from the script's own checkout first**, falling back to `CLAUDE_PROJECT_DIR` only when that checkout has no tree - with a symlink walk, because `~/.claude/hooks` symlinks back into this repo and `BASH_SOURCE` plus a plain `cd` does not resolve symlinks.
3. **`--audit` batched into one `python3` pass** (was one interpreter per hook file). Needed because it is now on every stop's critical path: **1.82s -> 0.43s** across 116 hooks. Output and exit codes 0/1 unchanged; parity with the old per-name loop verified byte-for-byte on a perturbed real tree.
4. **"Cannot tell" is now distinct from "clean"** (exit 3). A tree that is torn mid-write, or parses but is the wrong shape, no longer reads as a clean repo - which would have cleared a live arm. This one was found the hard way: a suite run went red mid-flight while a concurrent teammate was rewriting `browser-tree.json`.

## Before / after

| | before | after |
|---|---|---|
| Cross-project write arms the flag | no | yes |
| `--audit` under foreign `CLAUDE_PROJECT_DIR` | exit 0, "clean" | exit 1, names them |
| Stop with unmanaged hook, flag never armed | exit 0, silent | exit 2, names them |
| Hook made by `cat >` / `cp` / git pull | never detected | caught at next stop |
| Invoked through a symlink | falls back to foreign repo | resolves the real repo |
| Torn / wrong-shaped tree | reads as clean, disarms | "cannot tell", arm preserved |
| Packaged repo | silent | silent (unchanged) |
| `--audit` cost | 1.82s | 0.43s |

## Verification

`claude/hooks/test-hook-registry.sh`: **52 passed, 0 failed** (was 29). Every new row was negative-controlled by running the new suite against the pre-fix scripts in an identical harness: **10 rows go red**, and the same harness with the fixed scripts is 52/52 - so the harness is not the variable. Legitimate exclusions (`test-*`, `*-lib`) and the silence of a properly-packaged repo are asserted explicitly, because a guard that fires on everything gets ignored.

The stop-gate rows run against a synthetic repo in `$TMPDIR` with its own `$HOME`, so they assert the gate rather than this repo's tidiness. A row that goes red merely because the real tree is momentarily dirty teaches you to ignore the suite.

## Cross-model review (Codex, real verdict in 156.7s)

Four findings, all folded, all re-verified:

- **High** - `--audit` could exit 1 with nothing printed if the python raised after the JSON parse (wrong-shaped tree, `install.sh` vanishing between the `-f` test and `open()`). The gate reads 1 as "found some", so an empty found-set would have cleared a live arm. Fixed at both ends: exit 1 is now reserved for a completed audit with names, everything else is 3, and the gate refuses to act on the self-contradictory "rc 1, zero names".
- **High** - symlink invocation could still resolve the wrong repo, reopening the same blind spot under a different name. Fixed with the symlink walk; covered by a test.
- **Low** - an existing assertion had `&& ok ... || ok ...` and could not fail. Now calls `bad`.
- **Low** - the parity row did not fixture the asymmetric cases (in the tree but not the installer, and vice versa), so a batch rewrite accepting either half alone would still pass. Both fixtured now.

## Self-analysis

**Why did this happen?** The guard was built on an assumption nobody wrote down or tested: that a write into this repo comes from a session whose project *is* this repo. That holds for the common case and fails silently for every other one - a second project's session, a subagent with a different project dir, the Bash tool, a git pull. The assumption was invisible because the guard's own dogfood proof ("`--check hook-registry-guard` reported UNMANAGED before wiring and MANAGED after") exercised only the happy path.

**How did it go wrong, mechanically?** The gate keyed on a *breadcrumb* (a flag another component may or may not have dropped) rather than on the *condition* (is anything unmanaged on disk right now). A gate whose trigger is a proxy is only as good as every path that sets the proxy, and it fails **silently** when one does not - no error, no warning, just an early `exit 0`. That silence is why five days and two commits passed with nobody noticing. The generalisable rule: **an enforcement point must re-ask its own question at enforcement time.** Cheap enough to do every time is a design requirement, not an optimisation, which is why the audit had to be batched before the sweep could be unconditional.

**The near-miss worth recording:** the first instinct was that the PostToolUse matcher was too narrow, and that hypothesis is plausible enough that it would have produced a fix - a fix aimed at the wrong hole, leaving the real one open. Reading the transcripts instead of theorising took a few minutes and turned a guess into a proof. The transcripts in `~/.claude/projects/*/`*.jsonl* record the tool, the file path, the `cwd`, and the timestamp of every write; when the question is "how did this file get here", they answer it directly.

## Files touched

- `claude/hooks/hook-registry-stop.sh` - unconditional disk sweep, symlink-safe `REPO_DIR`, "cannot tell" handling
- `claude/hooks/hook-registry-guard.sh` - symlink-safe `REPO_DIR`, batched `--audit`, exit 3 for an incomplete audit
- `claude/hooks/test-hook-registry.sh` - 23 new assertions, hermetic sandbox section, tautological row repaired

Not touched, by design: `install.sh`, `claude/hooks/browser-tree.json`, `.claude/settings.json` (the wiring was never the problem - it was correct and active throughout).
