---
name: Motion review + vocabulary shipped as ours; three process rules implemented
description: Executed both units Jonah approved from the recon - wrote our own motion-review protocol (tactical-polish) and motion vocabulary (motion-reference) with zero source attribution per directive, and implemented the three long-queued process ideas natively (leverage-ranked audit findings, verification-baseline-first, commit-stamped plans)
type: project
relates_to: [session_2026-07-03_external-skills-recon-round2.md]
---

Collaborator: Jonah. 2026-07-03.

Jonah approved both recon follow-ups with the directive: no source accreditation - write better versions and credit them to us. Everything below is written in our voice, restructured, reconciled with our existing values, and extended beyond the source material; a name sweep across every touched file confirms zero external attribution.

## Unit 1: three process rules, implemented natively (queued since June, finally landed)
- CLAUDE.md Verification Protocol gains #9 VERIFICATION BASELINE FIRST (no multi-step change on a repo with no runnable tests/typecheck/lint; establishing one is finding #1) and #10 COMMIT-STAMPED PLANS (plans/specs open with the short HEAD hash they were authored against; a drifted stamp means re-verify before executing - "a drifted plan is a hypothesis, not an instruction").
- sidecoach SKILL.md audit step now mandates LEVERAGE ordering: within each severity tier, findings ranked by impact/effort weighted by confidence; missing verification baseline is always finding #1. Doc-level rubric (the agent composes reports); code-level sort unchanged.

## Unit 2: two new motion capabilities, ours
- claude/skills/tactical-polish/motion-review.md (NEW): the motion REVIEW protocol - frequency-first gate (100+/day = never animate; keyboard actions never animate), ten standards, flag-on-sight list, 9-step fix hierarchy (delete > reduce > easing > origin > interruptible > GPU > asymmetric > polish > gate), reference values (easing decision order, house curve set incl. our existing --ease-swap token, per-element duration budgets, springs, @starting-style entry, gesture velocity/damping/pointer-capture rules, clip-path uses, crossfade blur masking), findings-table + tiered-verdict + block/approve output format, and slow-mo/frame-by-frame/real-device/fresh-eyes debugging. Reconciliations with our canon: press stays OUR 0.96 (not 0.97), stagger split resolved per the June eval note - 30-80ms per-item lists vs ~100ms semantic sections (closes a queued conflict).
- claude/skills/motion-reference/VOCABULARY.md (NEW): reverse-lookup motion glossary (loose description -> precise term, with disambiguation protocol). EXTENDED beyond the source with our stack's vocabulary: a Scroll mechanics section (scrub, pin, snap, smooth scroll), FLIP, split-text reveal - terms the source glossary lacked.
- Wiring: tactical-polish SKILL.md (Quick Reference row + description now owns "review this animation" - harness reloaded it live); motion-reference SKILL.md (Naming an effect section); install.sh both tp_file loops + motion-reference block ship the new files (bash -n green); live copies synced (~/.claude/skills/tactical-polish/ now 6 files, motion-reference 2); extraction mirror copy at sidecoach/reference/_extracted/tactical-polish/motion-review.md; sidecoach live SKILL.md confirmed symlink to repo.

## Verification
- Attribution sweep across every touched file (repo + live): zero hits for any source name, site, or source-adjacent library name. Retired-name guard screened all .md writes (all passed = no banned words used).
- install.sh bash -n green; installer file lists updated in both bundle and a-la-carte paths.
- Not done here (still queued): the remaining six-skills borrow list (pause-offscreen, CSS-var perf as detector, tool-boundaries discipline, a11y remediation mode, forced-divergence variants) - only the 3 approved process ideas + the 2 new motion capabilities were in scope.

Files touched: claude/skills/tactical-polish/{motion-review.md NEW, SKILL.md}; claude/skills/motion-reference/{VOCABULARY.md NEW, SKILL.md}; claude/skills/sidecoach/SKILL.md; claude/CLAUDE.md (protocol #9, #10); install.sh; sidecoach/reference/_extracted/tactical-polish/motion-review.md (NEW); live ~/.claude/skills syncs; this beat + MEMORY.md.
