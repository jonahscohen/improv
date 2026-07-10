---
name: June borrow backlog - all four buckets dispatched to an Opus team
description: Jonah approved all four queued June-eval borrow buckets (animation perf, a11y remediation, design judgment rules, team process) with directives - additive only, agents execute (cost model); four opus-executor teammates dispatched with non-overlapping file ownership; team-init orphan repaired mid-session per the documented fix
type: project
relates_to: [session_2026-07-03_external-skills-recon-round2.md, reference_cmux_team_init_orphan_bug.md]
---

Collaborator: Jonah. 2026-07-03.

Jonah approved implementing ALL FOUR queued borrow buckets from the 2026-06-12 six-skills evaluation, with three directives: additive not subtractive to current work; deploy agents (Fable orchestrates, Opus executes per the cost model); Codex helps at review time.

## Team-init repair (the documented orphan bug, second occurrence)
First spawn attempt failed: team file for the session id not found - the compaction-continuation case from reference_cmux_team_init_orphan_bug.md (the team system wanted a new team id that startup never initialized; only yesterday's team dir existed). Applied the beat's verified mid-session repair (create config.json + inboxes/team-lead.json with the schema recorded there) - all four spawns succeeded immediately after. The repair beat's 2026-06-29 correction is now twice-verified.

## Dispatch (4 opus-executor teammates, one unit each, non-overlapping file ownership)
Sequencing lesson applied (the 2026-06-25 concurrent-edit miss): no two teammates share a file; shared surfaces (sidecoach SKILL.md pointers, install.sh, live ~/.claude/skills syncs, extraction mirrors, MEMORY.md/beats) are LEAD-owned and integrated sequentially at fold time. All teammates forbidden from beats/MEMORY.md writes and from naming any external source in shipped text.

- motion-perf: motion-reference SKILL.md (CSS scroll-driven animations incl. scroll()/view() vs ScrollTrigger guidance; View Transitions API) + tactical-polish performance.md (pause off-screen loops; rAF stop conditions) + motion-review.md (blur budget unification <=8px animated / 2-4px masking / ~20px static-decorative only; three new flag-on-sight lines).
- a11y: NEW sidecoach/reference/a11y-remediation.md (remediation mode, tool-boundaries restraint discipline, five micro-rules, three audit failure patterns).
- taste-rules: NEW sidecoach/reference/design-judgment-rules.md (one accent per view, no mixed primitive systems, staging rules, exit-only context menus, springs-for-overshoot - each with violation shape + exceptions, validator-ready precision).
- team-process: design-team SKILL.md (forced-divergence five-axis exploration mode, shared fixtures, CD-review scoring unchanged) + NEW sidecoach/reference/robustness-stress-checklist.md (six stress axes for the harden verb).

## FOLD COMPLETE (same day) - all four units accepted, team retired
- All four teammates delivered, were independently verified by the lead (structure, voice, attribution sweeps, ownership boundaries), accepted, and torn down per the lifecycle rule (0 processes, 0 panes confirmed). Standout deliveries: taste-rules added a validator-facing Rule index table beyond spec; team-process correctly flagged that the single deletion in its diff was the lead's earlier in-flight rename, not its own edit; motion-perf resolved both value tensions as scoped complements (4px icon blur framed as budget-compliant; the old "under 20px" clause rewritten in place to agree with the new 8px animated ceiling).
- Pointer integration (lead): sidecoach SKILL.md verb table now routes audit -> a11y-remediation.md, critique -> design-judgment-rules.md, harden -> robustness-stress-checklist.md; motion-reference integration bullet cross-refs the tactical-polish perf rules; tactical-polish SKILL.md points at the native-animation guidance.
- Codex review of the combined diff: 4 MEDIUM + 1 LOW, ALL FOLDED - (1) wrong claim that background tabs keep scheduling rAF frames (browsers pause rAF in hidden tabs; rationale rewritten to logical-cleanup/resume-control), (2) wrong claim that unsupported animation-timeline freezes the from state (it is ignored and the animation plays on load; warning rewritten, @supports guard corrected to the view() condition), (3) will-change allow-list contradiction (clip-path row in the GPU table qualified to partial/profile-first, SKILL.md trio stays headline), (4) forced-divergence Axis E logical impossibility (one builder briefed both quieter AND louder; now dispatcher picks one direction, both edges = second E slot), (5) bare cubic-bezier string used as a Tailwind class in two className lists (now ease-[cubic-bezier(...)]; the prose table reference was correct and untouched).
- Post-fold verification: incorrect claims grep to zero; final attribution sweep across every touched file zero; live ~/.claude/skills syncs + extraction mirror re-synced after folds.
- Harness observation from two teammates (logged, no action): the second-fix PostToolUse gate false-fires on parallel teammates writing DIFFERENT files in the same directory - it keys per-directory. Candidate tuning: key per-file. Both teammates correctly declined to touch the suppress flag. Consistent with the hooks-prefer-false-positives posture.

Files touched (full unit): ~/.claude/teams/session-<id>/ (repair); claude/skills/design-team/SKILL.md; claude/skills/motion-reference/SKILL.md; claude/skills/tactical-polish/{SKILL,performance,motion-review,animations}.md; claude/skills/sidecoach/SKILL.md; sidecoach/reference/{a11y-remediation,design-judgment-rules,robustness-stress-checklist}.md (NEW x3); sidecoach/reference/_extracted/tactical-polish/* (mirror); live ~/.claude/skills syncs; this beat + MEMORY.md.
