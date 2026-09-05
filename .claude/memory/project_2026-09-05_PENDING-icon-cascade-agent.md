---
name: PENDING - spawn icon-cascade agent after cmux relaunch
description: Jonah-mandated iconography cascade rebuild; agent spawn blocked by stale tmux backend, resumes after a cmux relaunch. Full locked brief inside.
type: project
relates_to: [feedback_ai_icons_lobehub.md, session_2026-09-02_env-cwd-eperm-transient-resume.md, session_2026-08-07_cmux-team-config-heal.md]
superseded_by: decision_2026-09-05_icon-priority-cascade.md
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

**STATUS: PENDING a cmux relaunch.** Jonah mandated an iconography cascade rebuild and chose to relaunch cmux (teammate spawning was broken this session - stale tmux backend after multiple day-long resumes; the team-file layer was hand-healed but the tmux server underneath is dead, which only a relaunch restores). After the relaunch, SPAWN a named general-purpose teammate "icon-system" with the brief below. Do not do it in-line unless Jonah says to; he specifically wants an agent.

**LOCKED SPEC - the 8-rule cascade (Jonah, verbatim intent):**
Interactive elements (buttons/toggles/links/controls):
1. Figma reference available -> extract the icon FROM the Figma file (design-source discipline, RULES.md item 3 + 12).
2. No Figma -> ANIMATED library, order: Lucide Animated, Heroicons Animated, Hugeicons Animated.
3. No animated icon for the concept -> reicon (https://github.com/dqev/reicon).
4. Not in reicon -> static fallbacks: Lucide, Heroicons, Hugeicons, Phosphor, Material Symbols, etc.
Non-interactive:
5. Animation deprioritized -> reicon first, then static fallbacks.
6. Illustrations (vs stock photo) -> reicon, or offer imagegen (sidecoach-image).
7. Company/brand logos (Anthropic, OpenAI, ...) -> LOBEHUB icon library OR reicon logo library.
8. "Can't fail" - impose HARD, no gentle assertion, gate/hook for the mechanizable part.

**Reconciling assumptions (improv-pm; flag if evidence contradicts):**
- The context-cascade SUPERSEDES the old "one library per project" rule (a project now legitimately mixes Figma/animated/reicon/lobehub by context); keep one-library only within the static-fallback tier.
- Merge: interactive = Figma -> animated -> reicon -> static; non-interactive = reicon -> static; logos = lobehub/reicon-logos.

**Agent deliverables:** (A) rewrite the icon-source skill SKILL.md to the cascade decision tree with exact per-source verbatim sourcing; (B) hard rule clause in claude/RULES.md pointing to the skill; (C) fail-HARD gate for the MECHANIZABLE subset only (extend the fabricated-SVG gate; off-cascade-library detection; static-icon-on-interactive-with-Figma), honest about behavioral-only parts (a hook can't know if an animated icon exists for a concept or if Figma contains it); (D) falsification test suite (style of claude/hooks/test-figma-gate.sh); (E) beats (refresh feedback_ai_icons_lobehub.md, new decision beat).
**Agent research first:** read current icon-source skill; inspect reicon repo (what it is, contents, exact sourcing); verify Lucide/Heroicons/Hugeicons Animated + sourcing (Hugeicons is NEW); confirm lobehub sourcing; read the existing fabricated-SVG gate.
**Hard constraints:** gate must be SOUND and NOT over-block legit icon usage - SURVEY existing usage + cross-repo blast radius first (the recent fidelity-gate over-block caused a multi-day regression; do not repeat). Verbatim sourcing only, never fabricate SVG paths. No emdashes/emojis. Independent Codex review via `git diff | ~/.claude/hooks/codex-review.py "<prompt>" -C /Users/spare3/Documents/Github/improv`. Agent REPORTS back to improv-pm and does NOT commit; improv-pm reviews + commits.

**Infra note for the relaunch:** if the fresh session hits "team file for session-XXXX not found" again, hand-heal ~/.claude/teams/session-XXXX/ (config.json + inboxes/team-lead.json=[] + inboxes/descriptions.json=[]) mirroring a healthy team dir - the auto-heal hook (cmux-team-config-heal.sh) is wired but silently NOT healing on this machine (no-op'd even when fed the error payload); worth fixing separately.
