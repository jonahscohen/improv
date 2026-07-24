---
name: Three unmanaged hooks packaged into install.sh, the tree, and the GUI
description: task-loop-mandate + justify-queue-mandate assigned to the grounding cluster, justify-queue-drain-stop to the justify component; audit goes 1 -> 0
type: project
relates_to: [session_2026-07-15_stage3b-execution.md, session_2026-07-17_gui-installer-design.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: tests (255 assertions across 9 suites) + sandboxed deactivation + codex-review
confidence: high
---

# Three unmanaged hooks packaged (2026-07-23)

`bash claude/hooks/hook-registry-guard.sh --audit` exited **1** with three UNMANAGED hooks:
`justify-queue-drain-stop`, `justify-queue-mandate`, `task-loop-mandate`. They arrived in
f5a34036 and c2a640c8 and were never packaged, so they installed on no other machine and the
component browser under-reported. Audit now exits **0**, zero unmanaged.

## Component assignment, and why

The guard's header is explicit that a shell hook must not guess the owner from the filename.
In all three cases the repo had already *declared* the owner somewhere; only the registration
was missing. None of these was a judgement call made from the filename.

**task-loop-mandate -> `grounding` cluster.** Declared in three places already:
its own file header ("Part of the grounding cluster"), install.sh's `cluster_hooks grounding`
arm, and install.sh's grounding DESC (line 492: "plus the task-loop and justify-queue
mandates"). It was ALREADY installer-managed; the missing half was purely the tree.

**justify-queue-mandate -> `grounding` cluster.** Same three declarations. The tempting
alternative was to move it to the `justify` component because of its name. Rejected:
(a) its file header calls it a "Sibling of task-loop-mandate.sh" and both are context
injections about completion discipline, not Justify machinery; (b) it is wired through
`cluster-wirings.json`, the cluster mechanism, not `app-wirings.json`; (c) install.sh's own
user-facing grounding description already promises it to anyone who installs the cluster, so
moving it would have made that description a lie. The hook is about *not dogfooding the user*,
a behavioural mandate that stands whether or not the Justify server is installed.

**justify-queue-drain-stop -> `justify` component.** This one genuinely depends on Justify:
it is a Stop gate that polls the Justify daemon on port 9223 and fails open when the daemon is
unreachable. It was already in `app-wirings.json` (the app mechanism, which is what
`install_app_hooks` honours for the per-hook off-list), alongside its three justify-* siblings.
Shipping it to users without Justify would install a Stop hook that can never do anything.

## The tree was already lying, in the way the guard predicts

The grounding node's `tag` read "the 4 grounding hooks" and its `desc` named all four by
name, while its `hooks` array listed only two. That is exactly the sidecoach 2-vs-6 lie the
guard's header cites: the browser would render "2/2 active" for a cluster with four managed
hooks and offer no toggle for the other two. Adding the two entries makes the rendered count
agree with the prose that was already there.

## Changes

- `claude/hooks/browser-tree.json`
  - grounding node `hooks`: + task-loop-mandate, + justify-queue-mandate (in install.sh's cluster order)
  - justify Hooks node `hooks`: + justify-queue-drain-stop (appended last, see ordering note)
  - justify Hooks node `desc`: now mentions holding the session open until the queue drains
  - `hook_desc`: three human-written one-liners
  - `hook_owner`: justify-queue-drain-stop -> justify; both mandates -> grounding
- `install.sh`
  - `install_app_hooks` justify line: + justify-queue-drain-stop.sh
  - `deactivate_justify`: + justify-queue-drain-stop.sh (symmetry)
  - justify DESCS / FILES / post-install summary lines updated to name the new hook
  - the two mandates needed NO install.sh change - already in `cluster_hooks grounding`,
    and `deactivate_cluster` already derives their removal from cluster-wirings.json
- `claude/hooks/test-component-browser.sh` - fixtures only (see below)

**Ordering note (Why):** justify-queue-drain-stop is appended LAST in the tree's hooks list
because that list order feeds the installer off-list string. Appending keeps every existing
substring assertion valid and matches the order `install_app_hooks` now deploys in.

## Test fixture updates - no assertion was weakened

Two tests failed after the change, both because they encode justify's hook COUNT:
- test 8 (`stage_all install clears opposite pending`) - its INSTALLED fixture claimed
  "justify fully installed" while omitting the new hook, so `stage_all install` correctly
  staged the missing one and pending was 1, not 0. Fixture corrected.
- test 18 (`apply_pending_plan multi-hook off-list .sh suffix`) - exact-equality on the
  off-list string. Expectation grown to include the new hook, plus a comment recording that
  this coupling is deliberate and must grow with the component.

The four other "justify fully installed" INSTALLED fixtures were updated for the same reason
even though they passed either way: a fixture that claims a component is fully installed while
under-listing its hooks is the same quiet lie this suite exists to catch. Every assertion
still asserts what it asserted before, over one more hook.

**Then the cross-model review caught a real weakening I had missed** (see below): three
`case` assertions matched only a PREFIX of the off-list string, so they stayed green whether
or not the new hook was in the tree. Tightened to name every justify hook explicitly.

**Mutation-tested, because "the tests pass" does not prove they can fail.** Removing
justify-queue-drain-stop from the tree now turns test-component-browser RED with 6 failures,
including the exact three Codex flagged - which were GREEN under the same mutation before the
fold. That is the proof the assertions are load-bearing rather than decorative:

    every path literal in this suite exists in the tree
    installer and tree agree on every app hook (both directions)
    justify partial install plan
    disable-all-hooks keeps the component
    partial preserve plan
    apply_pending_plan multi-hook off-list .sh suffix

Tree restored and re-verified green afterwards.

## Cross-model review (codex-cli 0.142.5, different model)

Verdict: **5 CLEAN, 1 FINDING**, finding folded and re-verified.

- CLEAN - justify-queue-drain-stop belongs to the justify app: "daemon-coupled: it polls
  localhost:9223, uses Justify prompt IDs, points at ~/.claude/justify/justify-done.sh...
  Putting it in a generic cluster would make non-Justify installs run a Stop hook with
  Justify-specific behavior."
- CLEAN (with a recorded tradeoff) - the mandates in `grounding`. Codex called the assignment
  "coherent" and flagged the one cost honestly: `--only justify` will not install
  justify-queue-mandate, and `deactivate_justify` will not remove it while `grounding` is still
  installed. **Revisit if** "remove Justify" is ever meant to mean "no Justify wording anywhere";
  today the mandate is a behavioural rule about not dogfooding the user, which stands with or
  without the Justify server, so grounding remains correct.
- CLEAN - install/deactivate symmetry, both the app path and the cluster path.
- CLEAN - no ordering hazard. Also confirmed a runtime detail worth keeping: in
  app-wirings.json justify-watch-standing-by is wired BEFORE justify-queue-drain-stop, so the
  watch arm file is written before the drain gate reads it.
- CLEAN - nothing that breaks a fresh-machine install or the browser.
- FINDING (folded) - the three prefix-matching assertions described above.

## Verification

| Check | Before | After |
|---|---|---|
| `hook-registry-guard.sh --audit` exit code | **1** (3 unmanaged) | **0** (zero unmanaged) |
| `--check` per hook | 1 / 1 / 1 | 0 / 0 / 0 (all managed) |
| test-hook-registry | 28 pass / 1 fail | 29 / 0 |
| test-component-browser | 127 / 0 | 127 / 0 (and 6 RED under mutation, was 3) |
| test-settings-deploy-parity | 21 / 0 | 21 / 0 |
| test-installer-manifest | 1 / 0 | 1 / 0 |
| test-task-loop-justify-mandates | 6 / 0 | 6 / 0 |
| test-app-hook-offlist | 36 / 0 | 36 / 0 |
| test-install-hook-deploy | 26 / 0 | 26 / 0 |
| test-installer-gui-server / -launch | 6 / 0, 3 / 0 | 6 / 0, 3 / 0 |
| hooks in GUI manifest | 64 | **67** |

Totals after: **255 assertions passing, 0 failing** across 9 suites.

**GUI derives, it does not carry its own list (proved, not assumed).** `claude/installer-gui/manifest.py`
takes browser-tree.json as argv[1] and passes each bucket's `members` through verbatim;
`index.html` hardcodes zero hook names and populates itself from `/manifest`. So registering in
the tree is sufficient for both installers. `bash install.sh --manifest` output went from ABSENT
for all three to:
- `Guardrails/grounding/task-loop-mandate` (state active)
- `Guardrails/grounding/justify-queue-mandate` (state active)
- `justify/Hooks/justify-queue-drain-stop` (state active)

**Deactivation proved in a sandboxed HOME** (the live machine was never deactivated; real
`~/.claude/hooks` count and settings.json sha were captured before/after and both were
unchanged). install.sh's REAL function text was extracted with awk rather than paraphrased,
because the lib-only seam (`IMPROV_INSTALL_LIB_ONLY=1`) returns before these functions are
defined:
- `deactivate_justify` removed all four justify hook files and stripped every justify command
  from settings.json; an unrelated bystander hook survived.
- `deactivate_cluster grounding` removed all four grounding hook files including both mandate
  commands and their ` turn` variants; bystander survived.

## Self-analysis - two process failures worth naming

**1. I shipped three weakened assertions and did not notice.** When tests 8 and 18 went red I
fixed exactly those two and moved on, treating "suite is green again" as "suite is as strong as
before." It was not: three `case ... in *"..."*` patterns matched a prefix of the off-list and
silently accepted the new hook's absence. The failure mode is that a substring assertion
DEGRADES QUIETLY when the data it samples grows - the same failure family this very suite
documents about itself at line 49 ("a green suite asserting against paths that do not exist is
worse than a red one"). The signal I missed: I was editing a file whose own comments warn that
green means nothing without a mutation check, and I still used green as my stopping condition.
The durable correction is the mutation test I now ran - flip the data, confirm the suite goes
red - which is the only evidence that separates a live assertion from a decorative one.

**2. I reported a false red across 40 suites.** I wrapped a repo-wide sweep in `timeout 120`;
macOS has no `timeout` binary, so every suite returned 127 with zero assertions. I caught it
because 0-pass/0-fail across the board is not a plausible regression shape, but the correct
order was to probe the harness (`command -v timeout`) before adding it, not after it produced
40 red lines. Tooling I introduce is part of the delta when something "breaks."

## Debugging note - a transient false positive

The first post-change audit reported `UNMANAGED: zz-registry-fixture`, but the file did not
exist on disk. Root cause: `zz-registry-fixture.sh` is a temp fixture created and deleted by
test-hook-registry.sh, and a concurrent teammate was running that suite (they hold live edits
to hook-registry-guard.sh / hook-registry-stop.sh / test-hook-registry.sh in the same working
tree). Confirmed transient by re-running the audit three times: exit 0, empty output, every
time. Worth knowing that `--audit` is racy against a concurrent run of its own test suite,
since the fixture is written into the very directory the audit scans.

## Lead verification (independent, 2026-07-23)

Re-checked rather than accepted, and the claims hold:

- `hook-registry-guard.sh --audit` exit code captured DIRECTLY (not through a pipe, which is how
  the lead misread it on the first probe): **exit 0, empty output.**
- All three present in BOTH installers: `browser-tree.json` and `install.sh` each name every hook,
  and `bash install.sh --manifest` (exit 0) carries `task-loop-mandate`, `justify-queue-mandate`
  and `justify-queue-drain-stop`. Jonah asked specifically that terminal AND GUI both get the new
  assets; the GUI is a derived view of the tree, so registering in the tree covers both - proved
  here, not assumed.

Two things in this unit are worth carrying forward as practice. The **mutation test** is the
standout: removing the hook from the tree turns test-component-browser RED with 6 failures where
the same mutation was GREEN on 3 of them before the Codex fold. That is the only evidence that
separates a live assertion from a decorative one, and it caught prefix-matching `case` patterns
that silently degraded as the data they sampled grew. The **component assignment** was likewise
derived from what the repo had already DECLARED (file headers, `cluster_hooks grounding`, the
grounding DESC) rather than guessed from filenames - which is exactly the discipline the guard's
own header demands and cannot itself perform.

Also logged: `--audit` is RACY against a concurrent run of test-hook-registry.sh, because that
suite writes `zz-registry-fixture.sh` into the very directory the audit scans. A transient
UNMANAGED report for a file that does not exist on disk is this race, not a real finding.

## Files touched

- claude/hooks/browser-tree.json
- install.sh
- claude/hooks/test-component-browser.sh
- .claude/memory/session_2026-07-23_unmanaged-hooks-packaged.md (this beat)

Not committed, per instruction. MEMORY.md deliberately not edited - the lead owns the index.
