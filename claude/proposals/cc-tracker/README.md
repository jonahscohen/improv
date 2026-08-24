# cc-tracker/ - the INERT Claude Code feature-proposal quarantine

This directory is the staging area for feature-tracking PROPOSALS produced by the Claude Code
feature-tracker (`claude/hooks/lib/cc-tracker.py` + the `/cc-track` flow, run daily by
`claude/hooks/cc-tracker-daily.sh` on the shared learning-researcher spine). Each
`<version>-<slug>.md` file is one proposal: a feature brief (with the changelog line quoted
inside an UNTRUSTED SOURCE EXCERPT fence), an opportunity (additive or redundancy, against our
harness surfaces), a draft `<step> -> verify:` plan, and optionally an illustrative draft patch.

## It is INERT by construction

Nothing in this repo imports, sources, or executes this directory. A proposal is therefore
physically unreachable by any hook, skill, installer, or build step - not "allowed but
discouraged", unreachable. The only writer is the tracker; the only reader is a human.

- The tracker NEVER writes a hook, a skill, `settings.json`, an agent, the installer, or any
  wiring table. Its only writes are these inert proposals, a `proposal_cc-features_*.md` queue
  beat, its run log, and a version cursor under `~/.claude`.
- Release notes / CHANGELOG / npm text are UNTRUSTED external DATA. They are fetched, parsed to
  structure, and quoted only inside a fence. No fetched text is ever followed as an instruction,
  and no Claude Code release ever auto-edits the harness.
- A proposal is a proposal, not a change. There is no auto-apply path at all.

## Applying a proposal (human-gated only)

A human reads the proposal and decides apply / defer / reject. To APPLY, either hand-edit the
harness, or dispatch an executor to implement the draft plan - which then runs the full
verification + cross-model review gate before anything lands. Approval is always a human action;
the tracker has no write path into the harness.
