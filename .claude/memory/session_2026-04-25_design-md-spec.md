---
name: Adopt google-labs-code/design.md spec for DESIGN.md files
description: Added a CLAUDE.md sub-section under Oracle's project-level setup requiring DESIGN.md to follow the Google spec (YAML tokens + prose), with `npx @google/design.md lint` as a post-write check.
type: project
---

Collaborator: Jonah Cohen

# What changed

New `### DESIGN.md format (Google spec)` sub-section in `claude/CLAUDE.md` under the Oracle -> Project-level setup section. Three rules:

1. When writing or updating `DESIGN.md` (via `/oracle document`, `/oracle extract`, or by hand), conform to the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec: YAML frontmatter tokens, markdown prose, canonical section order.
2. After writing the file, run `npx @google/design.md lint DESIGN.md` and address every error/warning (broken refs, WCAG contrast, schema violations) before reporting done.
3. Generated UI code must reference tokens via `{path.to.token}` rather than hard-coded hex values.

# Why

Oracle's strength is vibes (PRODUCT.md, brand personality, subjective design moves). Google's DESIGN.md spec is the formal token layer Oracle lacks. Combining them gives:
- Token references prevent hex-drift session-to-session
- The lint CLI catches WCAG contrast violations Oracle's audit doesn't enforce deterministically
- The diff CLI enables real change tracking on DESIGN.md updates

Spec is alpha so the rule may need to evolve as the schema settles. Worth adopting now because the structural win (machine-readable tokens) is permanent regardless of schema churn.

# How to apply

Live globally on every project this machine runs Claude Code in (CLAUDE.md is symlinked from `~/.claude/`). Other machines pick up via `git pull` or `yesplease`. No project-level changes needed yet; rule fires next time `/oracle document` or `/oracle extract` runs.

# Files touched

- `claude/CLAUDE.md` (new sub-section under Oracle project-level setup)
- `.claude/memory/session_2026-04-25_design-md-spec.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)
