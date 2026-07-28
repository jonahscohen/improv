---
name: Deactivate arms reported "nothing to remove" as failure and abandoned the rest of the plan
description: A trailing [ -d X ] && rm idiom made 13 of 23 uninstallable leaves exit 1 when already absent, and apply_pending stopped the plan - four-component uninstalls removed one and silently dropped three
type: project
relates_to: [session_2026-07-28_skill-deploy-verify.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests (15-row suite, 5 mutations with per-mutation baseline control, pristine-HEAD control, full 23-leaf sweep)
confidence: high
---

# The defect

Several deactivate paths ended in this idiom:

    [ -d "$CLAUDE_DIR/skills/$dir" ] && rm -rf "$CLAUDE_DIR/skills/$dir"

As the LAST command of a function, that returns 1 whenever the thing being removed is
ALREADY ABSENT. `deactivate_component` captures the arm's status directly (`_dc_rc=$?`),
and `apply_pending` treats a non-zero deactivate as a failed component and STOPS,
preserving the remainder of the plan as pending.

The misreported exit code is the small half. The real damage, measured on HEAD with a
four-component uninstall plan:

| | requested | removed | left installed | exit |
|---|---|---|---|---|
| HEAD | 4 | 1 (tactical-polish) | motion, icon-source, task-list | 1 |
| fixed | 4 | 4 | none | 0 |

Three requests dropped, with nothing in the output saying so.

`tactical-polish` was worse than its siblings. Its dispatch arm ends with a legacy-dir
sweep over a `*interfaces*` glob, and that glob matches nothing on any machine that never
had the pre-rename directory - which is every machine. So the arm returned 1 even on a
completely successful removal, and being first in the plan it took the rest down with it.

# The sweep - it was never one site

The lead flagged tactical-polish. Driving every uninstallable leaf through the real
`--apply-plan` path found **13 of 23 leaves failing**, not one:

- `Foundation/statusline`
- all 11 `Design Tools/Skills/*` leaves
- `Dev surface/task-list`

Those map to four code sites, plus a fifth with the same shape that is not leaf-reachable:

1. `deactivate_design_skill` - trailing conditional (accounts for 11 leaves)
2. `deactivate_task_list` - trailing conditional
3. `deactivate_statusline` - trailing conditional
4. the `tactical-polish` dispatch arm's legacy-glob loop
5. `deactivate_skills` - same shape, reachable via `deactivate_component skills` rather
   than through a tree leaf; fixed for consistency

Static reading alone would have missed some of these and flagged others wrongly: three
functions that LOOK vulnerable because they end in `done` are in fact safe
(`deactivate_discord` ends in `if ...; then ...; fi` inside its loop, which is 0 when the
condition is false; `deactivate_ampersand` ends in `cmd || warn`, and warn succeeds). The
empirical sweep is what separated real from apparent.

`Personal/*` leaves exit 2, which is the apply-plan allowlist rejecting them by design,
not a defect.

# The fix

Every site becomes `if X; then Y; fi`. An `if` with a false condition is 0, and when the
branch does run it still propagates a genuine `rm` failure. That distinction is the whole
point: the lazy fix is `return 0`, which would swallow a real removal failure and let
`apply_pending` record a component "inactive" while its files sat on disk. That would be
a worse bug than the one being fixed.

# Verification

New suite `claude/hooks/test-install-deactivate-status.sh`, 15 rows, driving the REAL
installer through the REAL `--apply-plan` path against mktemp HOMEs.

- Failure reproduced against pristine HEAD FIRST and pinned as rows. Against HEAD the
  suite is 3 passed / 12 failed, and the four-component row records the damage verbatim
  in its own failure message: `still_installed='icon-source motion-reference task-list'`.
- The whole family is one row: all 23 uninstallable leaves must exit 0 when the component
  is absent. A one-line fix that leaves three siblings fails that row.
- An ANTI-MASKING row makes `rm` genuinely fail (`chmod 500` on the parent so children
  cannot be unlinked) and requires non-zero. It is what stops the lazy fix.
- 5 mutations, each reverting one fix, all caught.
- The three rows that pass on HEAD are tree-independent by nature: anti-masking (HEAD also
  reports genuine failures correctly), the mutation-environment fixture check, and the
  repo-safety guard.
- No regressions: skill-deploy suite 52/52, prune suite 44/44, `claude/skills` clean.

# Self-analysis - I reintroduced the exact failure I had just been credited for catching

The first cut of the mutation section scored 4 of 5 mutations as CAUGHT. All four were
false. Mutants were written to `mktemp` in `$TMPDIR`, and `install.sh` computes
`REPO_DIR="$(cd "$(dirname "$0")" && pwd)"` - so every mutant resolved REPO_DIR to a temp
directory, failed to find `browser-lib.sh`, and exited 1 from
`apply-plan: could not load tree`. A non-zero probe reads identically whether the mutation
changed behaviour or the installer never started.

I had hit this exact failure earlier in the same session, diagnosed it, and written it into
the previous beat. Then I wrote a new harness and walked into it again.

What actually exposed it was the one mutation that did NOT report caught (the blanket
`return 0`). I started to explain that result - "maybe apply_pending has an independent
post-check" - and went to read `apply_pending` to confirm. It does not have one. The
explanation was wrong, and chasing it is what surfaced that all five probes were running
in a broken environment.

Two lessons worth more than the fix:

1. **An unexpected result deserves investigation before explanation.** My first instinct
   was to construct a story in which the tool was still fine. The habit that saved it was
   going to read the code the story depended on instead of asserting it.
2. **A mutation harness needs a baseline control, per mutation.** The suite now runs the
   UNMUTATED installer through the same probe in the same tree first, and if that does not
   report correct, the row fails as a BROKEN ENVIRONMENT rather than a caught mutation.
   That control makes this class of false catch impossible rather than merely noticed, and
   it is the thing I should have built the first time.

# Files touched

- `install.sh` - five deactivate sites converted from a trailing conditional to `if`
- `claude/hooks/test-install-deactivate-status.sh` - new, 15 rows + 5 mutations
