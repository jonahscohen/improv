---
name: Installer component-coverage audit - guard proven real, coverage boundary mapped
description: Negative-controlled proof that hook-registry-guard/stop actually fire (15 sandbox assertions), the exact coverage boundary of the enforcement, and the per-class disk-vs-installer drift audit across hooks/skills/agents/wirings/data files
type: project
relates_to: [session_2026-07-23_hook-registry-guard-escape-fixed.md, session_2026-07-26_agent-routing-task7-codex-fix.md]
author_human: Jonah
source: session
verified: sandboxed negative control (15 assertions, temp HOME + synthetic repo); baseline suites re-run
confidence: high
---

# Installer coverage audit (2026-07-27)

Collaborator: Jonah. Question asked: "are all our latest hooks and other things included
in the installer - there is a hook that is supposed to ensure that, is it actually taking
place?" An exit-0 `--audit` is not an answer to that, so the first task was to prove the
guard can go red at all.

## Verification baseline (Team Rule 9, probed BEFORE changing anything)

At HEAD `e42b9a57`, all five named suites run and pass:
test-hook-registry **52/0**, test-installer-manifest **1/0**, test-component-browser
**139/0**, test-install-hook-deploy **26/0**, test-settings-deploy-parity **ALL PASSED**.
So there is a real baseline to stack changes on.

## The guard DOES fire - negative-controlled, not assumed

Sandbox: `HOME=$(mktemp -d)`, a synthetic repo with its own minimal-but-real-shaped
`browser-tree.json` + `install.sh`. The real repo and the real `~/.claude` were never
touched. **15 assertions, 0 failures.**

| Probe | Result |
|---|---|
| clean repo, `--audit` | exit 0, silent (a guard that fires on everything gets ignored) |
| clean repo, Stop gate | exit 0, does not block |
| planted unregistered hook, `--audit` | **exit 1, names it** |
| planted hook, Stop gate | **exit 2, BLOCKS, names it** |
| planted hook, second stop | exit 0 (blocks once - cannot trap a session) |
| planted hook, real PostToolUse Write payload | **prints `UNMANAGED HOOK:`, arms the flag** |
| registered in tree ONLY (installer missing) | still caught |
| registered in installer ONLY (tree missing) | still caught (the sidecoach 2-vs-6 lie) |
| fully registered | goes GREEN again (responds to DATA, not to the filename) |

**Why the both-directions rows matter:** they prove the audit is not merely a filename
allowlist. It re-derives the answer from the tree AND from install.sh's own text, so
half-registration - the failure mode that actually shipped in 2026-07-16 - is still red.

### Fixture bug found and fixed (worth recording)

The first run showed 3 failures that were MY fixture's fault, not the guard's: I copied
`hook-registry-guard.sh` and `hook-registry-stop.sh` into the synthetic repo without
registering them, so the "clean repo" control was not clean. Both are `pinned_hooks` in
the real tree (project-scoped, deliberately not installer-managed). Adding them to the
fixture's `pinned_hooks` made the control honest and the suite went 15/0. The lesson is
the standing one: when a control row goes red, suspect the fixture before the subject.

## The 2026-07-23 disk-sweep fix genuinely closed the cross-project hole

This was reproduced rather than trusted from the prior beat. With a **foreign
`CLAUDE_PROJECT_DIR`** pointed at a different repo - the exact configuration that let
three hooks reach main unpackaged:

- `--audit` still exits 1 and names the hook (pre-fix it exited 0, "clean")
- the Stop gate still **blocks with exit 2** (pre-fix it returned at the flag check)
- invoked **through a symlink** (`~/.claude/hooks` is a symlink farm into this repo)
  it still blocks - the symlink walk is load-bearing and works

So the hole that produced the original escape is closed at the disk-sweep layer.

## The coverage boundary, stated plainly

**Caught:** any hook file on disk in `claude/hooks/*.sh`, regardless of how it got there -
Write/Edit/MultiEdit, `cat >`, heredoc, `cp`, `install -m`, git pull, merge, rebase - as
of the next Stop **that happens in this repo**. Both half-registrations are caught too.

**Missed:** the enforcement is wired only in THIS repo's `.claude/settings.json`. A
session whose project is another repo runs neither the PostToolUse guard nor the Stop
gate, so it gets no write-time feedback at all. The disk sweep converts that from a
permanent escape into a deferred catch: the hook is flagged at the next stop in improv.
The residual exposure is a commit that happens from the foreign session before any
improv session stops - which is exactly the 5-day window that produced the original
escape, now bounded rather than unbounded.

**The bigger miss, and the real answer to Jonah's question:** the guard covered
`claude/hooks/*.sh` and NOTHING else. Two entire component classes had no registration
guard at all, which is why drift accumulated in them silently.

## Per-class drift table (registered side derived from install.sh's own deploy code)

| class | on disk | deployed | drift |
|---|---|---|---|
| hooks `claude/hooks/*.sh` | 125 | 72 in tree + 4 pinned + exclusions | none (guard works) |
| **hook companion data `*.json`** | 9 | 7 | **`grounding-intent.json`, `consolidate-intent.json` - ZERO mentions in install.sh** |
| **skills `claude/skills/*/`** | 18 | 16 | **`consolidate`, `tilt-lab` - ZERO mentions in install.sh** |
| agents `claude/agents/*.md` | 3 | 3 | none possible - deployed by a GLOB, not enumerated |
| settings wirings | 68 hooks named | - | no wired-but-missing files |

Two apparent "ghosts" (`.` and `justify`) were regex artifacts of my own audit script,
not real drift - verified by hand before reporting.

### The runtime-breaking finding, measured rather than argued

`grounding-gate.sh` guards on `[ -f "$INTENT_FILE" ] || exit 0`, the identical shape to
the route-intent.json defect. Differential test on a matching prompt ("why is the sidebar
not rendering"): **573 bytes of nudge WITH the lexicon, 0 bytes WITHOUT.** On every fresh
install the hook loads, appears in the browser, and does nothing - forever, with no
signal. It is present on this machine only because it was hand-symlinked when built.

`consolidate-intent.json` is the same class but currently HARMLESS, and saying so
precisely matters: `consolidate-nudge.sh` falls back to hardcoded defaults, and the
shipped file's values are byte-identical to those defaults. So its absence changes
nothing today - it is a latent risk (any future tuning would not ship), not a live
defect. Reporting it as "broken" would have been an overclaim.

## Fixes

1. **`hook_data_files()` + `install_hook_data()` in install.sh** - a shared table, not a
   fourth per-hook special case. **Why a table:** names do not line up
   (`grounding-gate.sh` -> `grounding-intent.json`), so nothing is derivable from the
   filename, and the same bug had now been fixed twice by hand. **How:** both the cluster
   deploy loop and `install_app_hooks` call it, so cluster hooks AND app hooks are
   covered; `deactivate_cluster` and `deactivate_app_hooks` drive removal off the SAME
   table, so install/uninstall cannot drift apart. Uses `link_or_copy_data` (never
   `link_or_copy`) so a JSON file is never chmod +x'd.
2. **`consolidate` skill -> `memory`; `tilt-lab` skill -> `tilt-lab`.** Owners DERIVED,
   never guessed: `consolidate-nudge.sh` is already `hook_owner: memory` and installed by
   `picked memory`, and the skill is the action the nudge names; `tilt-lab` is already a
   component key whose block installs the app the skill documents. Both follow the
   `reflect` precedent (one component shipping a nudge hook plus its skill).
3. **install.sh FILES text corrected** - memory said "3 hooks merged" while deploying 4.
4. **`--audit-data` and `--audit-skills` on the EXISTING guard** (not a parallel tool),
   plus both sweeps wired into the Stop gate so they actually enforce rather than being
   CLI modes nobody runs.

## Enforcement design notes

- `hook_data` / `hook_data_excluded` live in browser-tree.json; an exemption must carry a
  written reason, because an exemption without one is a place to hide a dead hook.
- `--audit-data` checks FOUR directions: unregistered on disk, registered but undeployed,
  registered but missing from disk, and a stale owner whose hook is gone.
- **The carve-out and its safety catch:** a tree with no `hook_data` key exits 0, so the
  guard stays silent on older checkouts and on the `.sh`-only fixtures in
  test-hook-registry.sh. That could have become a silent disarm, so
  test-hook-data-parity.sh asserts THIS tree declares the registry - removing the key
  turns the suite red (proven: 19 passed / 5 failed) while the guard goes quiet.
- FLAG stays hook-only on purpose: the write-time guard clears entries from it by bare
  hook name, so mixing data/skill names in would strand entries nothing could clear. The
  ACK key spans all three classes instead, preserving blocks-once-per-distinct-set.

## Verification

Every new assertion was negative-controlled against the pre-fix state, per the standing
rule that a suite which cannot fail teaches people to ignore it.

| check | result |
|---|---|
| new suite vs PRE-FIX tree (git HEAD install.sh + tree) | **7 rows RED**, guard names all 9 unregistered data files |
| `--audit-skills` vs PRE-FIX install.sh | **exit 1**, names `consolidate` + `tilt-lab` |
| mutation: drop route-intent from `hook_data_files()` | route-intent suite **2 RED**, restored 53/0 |
| mutation: delete `hook_data` key | parity suite **5 RED** (carve-out cannot disarm) |
| M1-M7 hermetic mutations in `$TMPDIR` | all 4 finding classes fire; excluded file silent; torn tree = 3; no tree = 0 |
| real `install_hook_data` executed in a scratch CLAUDE_DIR | all 3 companions land; a hook with no companion deploys nothing |

Suites after: hook-registry **52/0**, component-browser **139/0**, install-hook-deploy
**26/0**, settings-deploy-parity **ALL PASSED**, app-hook-offlist **36/0**, installer-manifest
**PASS**, route-intent **53/0** (was 51), grounding-guard **11/0**, consolidate-nudge **18/0**,
**hook-data-parity 24/0 (new)**. All three audits exit 0; Stop gate silent.

### A stale assertion I had to strengthen, not weaken

Generalizing the route-intent special case turned two rows of test-route-intent.sh red:
both were substring greps for the literal `route-intent.json` inside a block I had
refactored away. The tempting fix was to delete or loosen them. Instead they were
replaced with STRONGER checks that execute the real `hook_data_files()` /
`install_hook_data()` (extracted with awk, not paraphrased) and assert the lexicon
actually lands - behavior rather than text - plus assertions that the removal loop is
table-driven. Mutation-proved: both go red when the table entry is removed. This is the
exact trap the 2026-07-23 beat names, where a green suite got quietly weaker.

## Self-analysis

**Two fixture bugs, same failure mode, and it is the useful lesson here.** My first
negative-control run showed 3 failures and my first parity run showed 2 - every one was
MY fixture being wrong, not the subject under test. The synthetic repo omitted
`pinned_hooks` for the two registry scripts, and later omitted `browser-tree.json` from
the exclusion list. The signal I nearly misread: a CONTROL row failing (the "clean repo
must be silent" row) is almost always the harness, because the control is the row with
no subject-side variable in it. Suspect the fixture before the subject when the control
is what broke.

**I guessed an owner and got caught by my own verification step.** Writing the
`hook_data` registry I put `sidecoach-preamble.sh` as the owner of the sidecoach
registries on the strength of the name. A one-line grep showed `sidecoach-keyword.sh` is
the sole reader of all three. That is precisely the failure the guard's own header warns
about - never infer the owner from the filename - and the only reason it did not ship is
that I verified a claim I had no evidence for. The rule earns its place: derive the
owner from what the repo already declares, and check even when it feels obvious.

**A collision I caused and did not detect early enough.** A second agent (`amp-selfheal`)
was editing install.sh concurrently. My mutation test rewrote install.sh twice (mutate,
then restore from a backup taken seconds earlier), and their suite - which reads
install.sh - went red mid-flight with 12 spurious failures. It recovered to 74/0 once the
file was stable, and their section-11 work was verified intact afterwards. But a
restore-from-backup against a file another writer owns is a real clobber risk, and I ran
it without first checking whether install.sh had a live writer. The correct order was to
`stat` the file twice before any write-restore cycle, which is the same in-flight check
the halting agent used. Mutation testing a SHARED file needs a copy of the repo, not the
working tree.
