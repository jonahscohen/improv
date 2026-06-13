---
name: Lane P1 - Task 7 TS segmentClauses fence corrected for conjunction-boundary parity
description: Plan-doc follow-up - replaced the buggy startsWith prefix form in Task 7's TS segmentClauses fence with a sticky word-boundary regex; verified byte-for-span identical to the Python side in node.
type: project
relates_to: [session_2026-06-13_lane-p1-task2-conjunction-boundary-fix.md]
---

Collaborator: Jonah

Team-lead-approved follow-up to the Task 2 conjunction-boundary fix (3ecda53). The note I had added to Task 7 still sat above a code fence showing the buggy `w.startsWith(cb)` prefix form - the "inherit a known defect" trap (fences get copied even when notes say otherwise). Lead said: correct the fence now.

## What changed (plan doc only)

`docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md`, Task 7 TS `segmentClauses` fence:
- Added `CONJUNCTION_RE`, built FROM `CONJUNCTION_BOUNDARIES` (single source of truth): `(?:, but|, and|, or|, yet|, so)(?![\w])` with flags `'iy'` (sticky + ignorecase).
- Replaced the `const w = masked.slice(i,i+6).toLowerCase(); CONJUNCTION_BOUNDARIES.some(cb => w.startsWith(cb))` block with `CONJUNCTION_RE.lastIndex = i; CONJUNCTION_RE.test(masked)`. Sticky `lastIndex = i` anchors the match at the comma, mirroring Python's `_CONJUNCTION_RE.match(masked, i)`; `'i'` mirrors Python `re.IGNORECASE`.
- Reconciled the parity note so it now affirms the corrected fence (removed the "NOT the startsWith prefix shown below" language, since the prefix form is gone).

## Verification (ran in node, not committed)

Implemented the corrected TS `segmentClauses` in a node script and diffed its spans against the Python `segment_clauses` over 14 cases (prefix traps butter/yetis/sodium/androids, real and/but/or/yet/so words, abbreviations, terminators, "And, but,"). Result: **IDENTICAL on all 14 cases**. node v20.19.6. No LLM/network (model-router-guard).

## Files touched

- docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md (Task 7 TS fence + parity note)
