---
name: sidecoach lane intent detection - design approved
description: Mode words replaced by 6 unnamed lanes + hybrid hook-scores/model-decides intent detection; spec written and approved by Jonah
type: decision
relates_to: [feedback_mode_words_unnatural.md, session_2026-06-11_model-router-guard.md]
---

Design approved by Jonah (2026-06-12) for replacing the six sidecoach mode
words with conversational intent detection. Spec at
`docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`.

Choice made: hybrid architecture - the hook lexically scores six lanes
(weighted natural-English phrase lexicons, deterministic, testable) and
injects ROUTE or CLASSIFY directives; the in-session model makes the final
call. Confident reads route + announce in one sentence and start immediately;
murky reads run ONE AskUserQuestion interview (top candidates + "just handle
it directly"). Mode words are removed entirely - no aliases.

**Alternatives considered:**
- Pure hook lexicons: rejected because the lexicon becomes a hidden glossary
  and novel phrasing misses entirely.
- Pure model-side classification: rejected because nothing is mechanically
  testable and it relies on directive-following every turn - the same
  reliability gap (2026-05-20) that moved detection into hooks originally.
- Hook calls a cheap LLM: ruled out by the model-router-guard
  (non-negotiable, 2026-06-11).

**Why this one:** deterministic where possible, judgment where needed; both
layers testable; the announcement replaces a confirmation pause as the
failure-catch; conservative thresholds (route_floor 3, route_margin 2,
classify_floor 2) make a wrong route rarer than one good question.

**Revisit when:** real-use misroutes exceed roughly one in ten lane reads, or
the interview fires so often it becomes ceremony - either signals the
thresholds or lexicons need retuning, or the lane set itself is wrong.

Key spec decisions: lanes keep the old verb chains verbatim (lane_build/
lane_ship/lane_delight/lane_live/lane_calm/lane_converge); precedence is
confident-lane > verb > murky-lane > nudge; ralph-loop.ts renames to
convergence-loop.ts; /sidecoach <free phrase> classifies skill-side against
the same lane table; marketing-site cheatsheet.html + sidecoach.html lose the
mode vocabulary. Out of scope: the 22 verbs (they pass say-it-out-loud), the
advisory nudge tier, visual-effects "bloom" (shader term), the ralph-loop CC
plugin in settings.json.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (new)
