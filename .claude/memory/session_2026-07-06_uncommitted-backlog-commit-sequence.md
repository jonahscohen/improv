---
name: Uncommitted backlog committed as a structured multi-commit sequence
description: Partitioned the week's uncommitted tree into 12 coherent commits on main (no push)
type: session
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
relates_to: [session_2026-07-06_beats-backlog-shipped.md, session_2026-07-03_retired-names-scrub.md]
---

Committed the entire uncommitted working tree (223 changed paths) as a
structured, dependency-ordered multi-commit sequence on `main`. No push, no
branches - explicit request to land the week's work in coherent commits.

**Why:** the tree had accumulated a full week of parallel workstreams (skill
rename, executive-report enforcement, justify toolbar evolution, beats
provenance/reflect/mcp, lotus HTTP bridge, harness guard hooks) plus ~25 session
beats, all uncommitted. One giant commit would be unreviewable; per-file commits
would fragment features.

**How:** built a verifiable partition manifest first. Classified every modified
file as pure retired-name scrub vs substantive change (replacement-aware
classifier), then assigned all 221 committable paths (223 minus 2 gitignored
artifacts) to exactly one of 12 commits via git-generated pathspec files.
Ran a coverage + disjoint check (union == universe, no missing/stray/dupes)
before staging anything. Renames staged as old+new pairs in one commit so git
detects them as renames (9 detected: 4 beats, 5 extracted refs).

**Commit groups (order):** 1 skill rename + guard updates; 2 skills doc
capabilities (motion vocabulary, scroll-driven, design-team divergence);
3 sidecoach reference docs + diagnose-intent tier; 4 executive-report
enforcement + surface presentation; 5 Fable-orchestrates cost-model guard hooks;
6 justify toolbar theme + marker-var sweep; 7 beats provenance; 8 scheduled
reflect; 9 beats MCP server; 10 lotus HTTP bridge; 11 install wiring integrator;
12 records (index + tasks + session beats).

**Judgment calls:**
- Justify committed as ONE unit, not split: theme system and marker-var repaint
  sweep are interleaved within toolbar.ts / index.ts / prompt/index.ts, so a
  feature-split would orphan halves of each. Coherence beat the suggested split.
- install.sh is cross-cutting (skill rename + reflect + mcp wiring in one file);
  placed as a late integrator commit after its referenced files exist in tree.
- claude/CLAUDE.md kept whole in the executive-report commit (carries a minor
  provenance-doc rider) rather than hunk-split.
- .gitignore gained two artifact rules: `__pycache__/` + `*.pyc` (with the
  codex-review hook commit) and `claude/settings.json.bak.*` (with install).

**Gates:** beats/_tests/test-beats-hooks.sh green (21/21) and
`beats.py verify --quiet-provenance` exit 0, both before and after the sequence.

Files touched: whole working tree (12 commits), plus this beat.
