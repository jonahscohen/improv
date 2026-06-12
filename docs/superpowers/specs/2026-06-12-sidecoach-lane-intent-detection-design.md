# Sidecoach Lane Intent Detection - Design

Date: 2026-06-12
Collaborator: Jonah
Status: approved design, pre-implementation

## Problem

The six sidecoach mode words (forge, kiln, bloom, canvas, trim, ralph) fail the
say-it-out-loud test. They were optimized for hook detectability, which pushed
them toward pottery-metaphor nouns nobody naturally types. Jonah's verdict
(2026-06-12, `feedback_mode_words_unnatural.md`): "I hate all of those mode
words. They're unnatural conversationally." The vocabulary forces keyword
recall and a glossary instead of letting the user speak plainly.

The verb chains behind the words are good. The names are the problem.

## Decisions already made (with Jonah, this session)

1. **Mode words are removed entirely.** No hidden aliases, no deprecation
   window. The chains survive as unnamed lanes.
2. **Confident classification routes and announces.** One conversational
   sentence naming the read and the verbs, then work starts immediately. No
   confirmation pause on confident reads; the visible announcement is the
   failure-catch.
3. **Architecture is hybrid: hook scores, model decides.** The hook lexically
   scores all six lanes deterministically and injects a structured directive;
   Claude makes the final call in-session with full context. Murky cases run a
   single AskUserQuestion interview. Interviewing is a pathway to specificity,
   not a failure mode (Jonah, 2026-06-12).
4. **Thresholds start conservative.** Route only on strong, unambiguous
   signal; everything else interviews or falls to the advisory nudge. A wrong
   route is costlier than one good question.

## Constraint

The model-router-guard (non-negotiable, 2026-06-11) forbids routing to another
model. Classification is therefore deterministic in the hook plus in-session
judgment by the main model. No LLM calls from hook code.

## 1. Lane model

Six lanes replace six modes. A lane is an internal routing target with a
plain-English label; internal ids never surface in conversation.

| Internal id | Plain label (user-facing) | Verb chain |
|---|---|---|
| `lane_build` | a ground-up build | shape, craft, polish |
| `lane_ship` | a release-readiness pass | audit, critique, harden, adapt, polish |
| `lane_delight` | a personality pass - color, motion, delight | colorize, delight, animate, polish |
| `lane_live` | live in-browser iteration | live, colorize, polish, critique |
| `lane_calm` | a tone-down pass - quiet it to essentials | quieter, distill, clarify, polish |
| `lane_converge` | iterate-until-it-passes looping | polish, audit, critique (looped) |

FlowId chains carry over from `modes.ts` unchanged. Each lane record:

```
{
  "lane": "lane_ship",
  "label": "a release-readiness pass",
  "description": "Audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.",
  "interviewLabel": "Get it ship-ready",
  "verbChain": ["audit", "critique", "harden", "adapt", "polish"],
  "lexicon": [ { "pattern": "...", "weight": 3 }, ... ]
}
```

`interviewLabel` is the short AskUserQuestion option text (1-5 words).

## 2. Lexicons

Per-lane weighted regex fragments matched with the existing hyphen-aware word
boundaries against the sanitized prompt. Weights: 3 = strong (near-unambiguous
phrasing), 2 = medium, 1 = weak (only meaningful in combination). The JSON
registry is the single source of truth; tune freely without touching code.

Representative starting lexicons (implementation tunes and extends):

- `lane_build`: "from (?:the ground|scratch)" 3, "ground[- ]up" 3,
  "net[- ]new" 2, "brand new" 2, "build (?:me|us|out) a" 2, "start fresh" 2
- `lane_ship`: "(?:ready|get(?:ting)? (?:this|it)? ?ready) (?:for|to) (?:ship|launch|release|production|prod)" 3,
  "production[- ]ready" 3, "ship[- ]ready" 3, "release[- ]ready" 3,
  "before (?:we|it) (?:ship|launch|go(?:es)? live)" 3, "go(?:ing)? live" 2,
  "launch(?:ing)?" 1
- `lane_delight`: "more personality" 3, "bring (?:it|this|the .{1,30}) to life" 3,
  "feels? (?:flat|lifeless|sterile|bland|boring|dead)" 3, "liven (?:it |this )?up" 3,
  "add (?:some )?(?:delight|joy|life)" 3, "make it pop" 2, "more playful" 2
- `lane_live`: "live (?:iteration|tweak|tuning|session)" 3, "iterate (?:on it |on this )?live" 3,
  "while I watch" 3, "tweak (?:it )?(?:live|in the browser)" 3,
  "in the browser until" 2
- `lane_calm`: "calm (?:it|this) down" 3, "tone (?:it|this)? ?down" 3,
  "too (?:busy|loud|noisy|cluttered|much going on)" 3, "strip (?:it |this )?back" 3,
  "quiet(?:er)? (?:it|this)? ?down" 3, "declutter" 2, "less is more" 2,
  "simplif(?:y|ied)" 1
- `lane_converge`: "until (?:it|everything|all .{1,20}) pass(?:es)?" 3,
  "keep (?:iterating|going|looping) until" 3, "don'?t stop until" 3,
  "to convergence" 3, "loop (?:on it |over it )?until" 3, "relentless(?:ly)?" 2

Existing sanitization (code fences, backticks, URLs, XML bodies, transcript
markers) and informational-framing suppression apply unchanged before scoring.

## 3. Hook scoring tier (`sidecoach-keyword.sh`)

Replaces the mode-matching tier. Score per lane = sum of matched pattern
weights (each pattern counts once). Config block in `sidecoach-lanes.json`:

```
"config": { "route_floor": 3, "route_margin": 2, "classify_floor": 2 }
```

Decision logic, evaluated against (top, second) lane scores:

- **ROUTE** when `top >= route_floor` and `top - second >= route_margin`.
- **CLASSIFY** when not routed and `top >= classify_floor` (a real lane signal
  exists, but it is weak or contested).
- **Fall through** otherwise: verbs tier, then the existing advisory intent
  nudge, both unchanged.

Hook precedence (replaces mode > verb):

1. Confident lane (ROUTE) - the higher-level shape-of-work signal wins
2. Explicit verb match - existing behavior, unchanged
3. Murky lane (CLASSIFY)
4. Advisory intent nudge - existing tier, unchanged
5. Silence

Lane routes and classify directives touch the cooldown state file exactly as
verb/mode routes do today. Explicit routes are never cooldown-suppressed;
CLASSIFY is also never cooldown-suppressed (it only fires on real lane signal).

### ROUTE directive (injected additionalContext, shape)

> Lane read: this prompt reads as {label} (evidence: {matched phrases}). Run
> the verb chain {verbChain} in order; do not compress the chain. Protocol:
> announce the read in ONE conversational sentence naming the work and the
> verbs, then begin immediately. Do not ask for confirmation. If the full
> conversation context makes this read clearly wrong, downgrade to a single
> AskUserQuestion interview instead of running the wrong chain.

### CLASSIFY directive (shape)

> Lane read: design-shaped prompt without a confident lane. Scores:
> {per-lane scores + evidence}. Lane table: {full table - labels,
> descriptions, verb chains}. Protocol: if conversation context makes one lane
> obviously right, announce and run it. Otherwise ask ONE AskUserQuestion with
> the top 2-3 candidates (use interviewLabel + description) plus the option
> "Just handle it directly" (no lane, treat as a normal request). Never chain
> a second question.

The directive always carries the full lane table so the in-session decision is
made with complete context: the hook advises, the model decides.

## 4. In-session protocol

- ROUTE: announce in one sentence ("Reading this as a release-readiness pass:
  audit, critique, harden, adapt, then polish.") and start. The announcement
  is mandatory - it is the failure-catch that replaces a confirmation pause.
- CLASSIFY: one AskUserQuestion, top candidates plus "Just handle it
  directly". The user's pick routes the lane (or not). One question maximum.
- These rules live in the directive text AND in SKILL.md so both the hook path
  and the skill path agree.

## 5. /sidecoach <phrase> direct lane

SKILL.md gains a routing rule: when `/sidecoach` is followed by text that is
not a known verb, phase command, or setup command, classify the phrase against
the lane table. Confident -> announce + run. Murky -> the same single
interview. The skill embeds the lane table (labels, descriptions, chains) so
no hook involvement is needed on this path.

## 6. Blast radius (verified by grep, 2026-06-12)

In scope:

- `sidecoach/src/modes.ts` -> `sidecoach/src/lanes.ts` (rewrite: Lane
  interface, LANES registry, getLane/getLaneChain/getLaneVerbChain). No TS
  importers of MODES exist today; consumers are the JSON mirror and docs.
- `claude/hooks/sidecoach-modes.json` -> `claude/hooks/sidecoach-lanes.json`
  (lane records + lexicons + config).
- `claude/hooks/sidecoach-keyword.sh` (mode tier -> lane scoring tier, new
  precedence, ROUTE/CLASSIFY emission).
- `claude/hooks/test-sidecoach-keyword.sh` (extend corpus; see Testing).
- `claude/skills/sidecoach/SKILL.md` (remove modes section; add lane table,
  in-session protocol, /sidecoach phrase routing rule).
- `claude/skills/sidecoach/CHEATSHEET.md` (remove mode words; document
  conversational routing).
- `sidecoach/mcp-server/src/tools/list-modes.ts` -> `list-lanes.ts`
  (`sidecoach_list_lanes`), plus its registry plumbing and tests:
  `tools.test.ts`, `keyword-resolver.test.ts`, `registry-missing.test.ts`.
- `sidecoach/src/ralph-loop.ts` -> `sidecoach/src/convergence-loop.ts`
  (mechanical rename, identifiers updated; the loop algorithm is untouched).
  `t20-ralph-loop.test.ts` renames with it.
- `install.sh` lines 1048 and 2613: `sidecoach-modes.json` ->
  `sidecoach-lanes.json` in the symlink/registry loops.
- `marketing-site/cheatsheet.html` (12 mode-word hits) and
  `marketing-site/sidecoach.html` (5 hits): replace the mode vocabulary
  section with the conversational-lanes story. Marketing copy changes go
  through the normal visual verification gate.
- `sidecoach/dist/*`: rebuild after source changes.

Explicitly OUT of scope (false-positive grep hits, do not touch):

- `claude/skills/visual-effects/*` "bloom" - the shader/post-processing
  effect, unrelated.
- `claude/settings.json` `ralph-loop@claude-plugins-official` - the official
  Claude Code plugin, unrelated.
- `sidecoach/reference/_extracted/*` - vendored reference material.
- Beat files under `.claude/memory/` - historical record, never rewritten.

## 7. Testing

Extend `claude/hooks/test-sidecoach-keyword.sh` with a lane corpus: a table of
natural-phrasing prompts -> expected directive class (ROUTE:lane / CLASSIFY /
VERB:x / NUDGE / SILENT), runnable offline, deterministic. Minimum coverage:

- One strong-signal prompt per lane -> ROUTE with the right lane (6 cases).
- A genuinely ambiguous prompt ("make this page better") -> CLASSIFY.
- A weak single signal ("maybe simplify?") -> not ROUTE (CLASSIFY or NUDGE
  per thresholds).
- Mode words as plain English ("trim the whitespace", "canvas element",
  "bloom effect") -> never lane-route (the words are gone; these must hit
  verb/nudge/silence paths only as their natural meaning warrants).
- Informational framings ("what is a release-readiness pass?") -> suppressed.
- Existing verb and nudge cases keep passing unchanged.

TypeScript side: existing test suites updated for lanes.ts, list-lanes, and
the convergence-loop rename; `npm test` and the tsc build must pass.

Failure-proofing invariant: any design-shaped prompt that does not route
cleanly lands in either the interview or the advisory nudge. There is no path
where lane intent is detected and then silently dropped.

## 8. Out of scope for this feature

- The 22 verbs stay as direct triggers - they already pass the
  say-it-out-loud test (polish, audit, critique are natural English).
- No new magic keywords of any kind (standing rule from
  `feedback_mode_words_unnatural.md`).
- The advisory intent-nudge tier keeps its current behavior and lexicon.
- Lane membership and verb chains are not redesigned; only the trigger layer.
