---
name: Borrow-list reconciliation - every prior gap list vs the 2026-07-23 upgrade plan
description: Reconciled all prior oracle/design gap-borrow lists against the sidecoach upgrade plan so the un-covered backlog is visible. Wrote a reconciliation doc + amended the plan with a Section 7 OPEN+UNSCHEDULED backlog. Headline - the plan is blind to the 3 mission-primary simplicity/portability gaps (rubric GAP3/4/5) and adds machinery against the "simpler" half of the /goal. "Fifth" borrow list is a loose count (really 6 design-competitive, 11 across both lineages). named-vibe-variants.md is an _extracted reference file, not a gap-list beat.
type: project
relates_to: [session_2026-07-23_sidecoach-upgrade-plan.md, session_2026-07-23_oracle-v4-gap-analysis.md, decision_sidecoach_upgrade_first_units.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: read every named gap list + shipping/decision/mission beats; grep-confirmed named-vibe-variants provenance; both deliverables confirmed on disk; touched zero code
confidence: high
---

Collaborator: Jonah. 2026-07-23. Named teammate "reconcile", READ-OVER-MEMORY task. Deliverables:
`docs/superpowers/plans/2026-07-23-borrow-list-reconciliation.md` (new) + a Section 7 append to
`docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`. No code changed (the Stage 3a/4a parallel
builds are live in `sidecoach/`; stayed out of them).

## What was done
- Enumerated every prior gap/borrow list, followed relates_to transitively, re-grepped
  (`grep -rilE "borrow list|gap analysis|gap list|absorb"`).
- Bucketed every gap from every list into SUBSUMED / OPEN+SCHEDULED / OPEN+UNSCHEDULED / DEAD / UNKNOWN,
  de-duplicated to one row per gap (earliest capture), recurrence noted.
- Amended the plan with a terse surfaced backlog (append-only Section 7), not a re-plan.

## Load-bearing findings
1. **The plan is blind to the 3 MISSION-PRIMARY gaps.** The 2026-06-23 rubric's GAP3
   (maintainability: 6+ routing impls, triplicated classifier, ~138 files/~40k SLOC), GAP4
   (distributability: no plugin manifest, absolute paths, build-required), GAP5 (workflow
   simplicity: 4 parallel vocabularies) are the /goal's named biggest objectives
   (`feedback_sidecoach_mission_beat_oracle.md`) and NONE of the four upgrade stages touch them.
   Worse, the plan ADDS machinery (detect CLI, two generators, a provider-sampling harness), which
   pushes AGAINST the mission's "more capable AND simpler" spine. This is the headline.
2. **"Fifth borrow list" is a loose, self-incrementing label.** The 07-16 beat calls itself "the
   FOURTH borrow list" then "capturing it a THIRD time" one sentence later - proof the ordinal was
   never counted. Counting rule adopted: one beat = one list, primary product is an external-gap
   enumeration; absorption-DONE logs and capability MAPS are not lists. Verified count: 6
   design-competitive gap lists (lineage A), 11 across both lineages (A + external-skill recon B).
   "Prior four never drained" UNDERCOUNTS the real borrow debt; the plan's meta-finding is correct
   but understated.
3. **named-vibe-variants.md citation drift.** No such file in `.claude/memory/` (it is not a beat).
   The real file is `sidecoach/reference/_extracted/external/taste-skill/named-vibe-variants.md` - an
   extracted POSITIVE style-archetype reference (minimalist/soft/brutalist/gpt vibes), not a gap list.
   The gaps attributed to it on 2026-05-25 were actually captured in
   `session_2026-05-25_capability_gap_analysis.md` + `session_2026-05-25_external_taste_absorption.md`.
   The 07-16 and 07-23 beats point at the wrong object; the spirit (gaps captured 05-25, shelved) holds.
4. **Buckets:** SUBSUMED 10, OPEN+SCHEDULED 4, OPEN+UNSCHEDULED 19 (several clusters), DEAD 9 (7
   obsoleted/cut + 2 already-closed: OMC MCP server + eval harness), UNKNOWN 2. The 4 honesty defects
   from the four-product list are all DEAD-by-our-own-shipped-fix (`session_2026-07-16_honesty-defect-fixes.md`).
   Live Mode is DEAD (Jonah cut it, `decision_live_mode_rejected.md`, landed `4d61ba1f`).
5. **The "three re-captured gaps" made concrete:** generative/palette (05-25 -> 07-16 -> 07-23),
   anti-sameness roll (05-25 -> 07-16 -> 07-23), detector/scanner unification (06-23 -> 07-16 -> 07-23),
   taste-coverage (05-25 -> 06-23 -> 07-16 -> 07-23, 4x). These are now SUBSUMED by Stages 1-4 - the
   plan does drain them; it is the OTHER residue (rows 15-33) it never accounts for.

## Plan-drift folded (from decision_sidecoach_upgrade_first_units.md)
Plan stamped `a22d41fc`, HEAD `1ea7ae73` (3 commits ahead, benign). Font vocab lives in
`src/reference-data.ts` NOT `src/fontshare-reference.ts` (a service class); `bin/` has 7 files not 6.
Recorded in the doc's stamp note.

## Why / How
Why: the plan mitigated the "un-drained borrow list" risk for itself only, leaving lists 1-4's residue
invisible. How: transitive relates_to walk + re-grep, one-row-per-gap de-dup with earliest-capture, and
an append-only backlog so nothing was renumbered/rewritten.

## Files touched
- `docs/superpowers/plans/2026-07-23-borrow-list-reconciliation.md` (new, ~25 KB)
- `docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md` (append-only Section 7)
- this beat + MEMORY.md index. No code changed.
