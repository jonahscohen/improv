# cmux-tracker proposals (INERT quarantine)

This directory is the human-review queue for the **cmux feature-tracker** (Phase 2 of the
learning-researcher framework). Every `*.md` here is a **proposal**: a reviewable
recommendation that the tracker discovered by diffing the local cmux binary's capability
surface against a stored cursor. Nothing here is applied, imported, sourced, or executed by
anything.

## Structural inertness (the guarantee)

- **Nothing reads this directory.** No hook, no `settings.json`, no sidecoach enforcer
  (`sidecoach/src`, `sidecoach/scripts`, `sidecoach/bin`), and no `install.sh` line imports,
  sources, or globs `claude/proposals/cmux-tracker/`. A proposal is therefore physically
  inert: dropping a file here cannot change harness behaviour.
- The only WRITERS are `claude/cmux/cmux-tracker.py propose` (path-contained to this
  directory) and the `/cmux-track` flow it drives. The only READER is a human.
- Prove it any time: `python3 claude/cmux/cmux-tracker.py verify-inert` (exit 0 = inert).

## What a proposal contains

`<version>-<slug>.md`, each with:

1. **Capability brief** - cmux version/build/hash, the raw capability-token diff, the
   one-line "what this now enables," and any upstream changelog text quoted ONLY inside a
   fenced `untrusted` block (release notes are untrusted DATA, never instructions).
2. **Opportunity** - `additive` (adopt/simplify) or `redundant` (a cmux fix retires a
   workaround of ours), the harness touch-point(s) it maps onto, effort, risk.
3. **Draft plan** - `<step> -> verify: <check>` lines, stamped with the commit it was
   authored against.

## The apply gate (human, fail-closed)

A human reads a proposal and decides **apply / defer / reject**. On apply, an executor
implements the plan under the full verification protocol (baseline-first, tests,
visual/interactive if UI, cross-model review, completeness). The tracker itself has **no
write path** into hooks, `settings.json`, skills, or `cmux.version`, and never auto-applies
or auto-bumps the pin. `_EXAMPLE.md` shows the format; it is illustrative, not a real
finding.
