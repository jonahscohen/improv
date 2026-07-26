---
name: Act on Stage 1 findings - default-typeface guidance line (proposed + validated)
description: Drafted a typeface-selection guidance line to counter the cross-provider default-typeface defect, and ran a WITH/WITHOUT ablation on claude-opus-4-8 to measure the fire-rate delta
type: project
relates_to: [session_2026-07-25_stage1-real-data-1c.md, session_2026-07-23_sidecoach-stage4a-default-typeface.md, session_2026-07-24_stage1a-1b-provider-defect-mining.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: measured (WITH/WITHOUT generation ablation, Stage 1b scanner)
confidence: high
---

# Act on Stage 1 defect-mining: default-typeface guidance line

Executing the Stage 1c findings (eval/corpus/defect-distribution.json): all three models over-produce
`default-typeface` (claude 20/20 = 100%, gemini 19/20 = 95%, gpt 18/20 = 90%) and `nested-cards`
(gpt 75%, gemini 60%, claude 35%). Task: PROPOSE a concrete guidance improvement (do NOT apply to shipped
SKILL.md / design-laws) and VALIDATE it reduces the defect with a real measured delta on claude-opus-4-8.

## Root-cause of the 100% default-typeface rate (why the finding is what it is)

Two mechanisms, both grounded in read code:

1. **The neutral generation prompt forbids external fonts.** `eval/provider-sample.mjs` PROMPT_RULES says
   "no external stylesheets, no external fonts, no external images, no scripts, no network requests." So the
   generator literally cannot `@import` a webfont; the path of least resistance is a system stack.
2. **The detector scores the DECLARED leading family, not the painted face.** `default-typeface` Ground A
   (`inPageTypeface` in src/validators/subjective-rendered-scanner.ts) fires when >= 75% of char-weighted
   CONTENT text LEADS with a family in SYSTEM_FONT_STACK_FAMILIES (reference-data.ts) or has no font-family.
   That vocabulary INCLUDES Arial, Helvetica, Helvetica Neue, Times, Georgia, Verdana, Tahoma, Trebuchet MS,
   Palatino, Book Antiqua, Menlo, Monaco, Consolas, Segoe UI, Geneva, Lucida - the "nobody chose" monoculture.
   So telling a model to "use Georgia" would NOT clear it. Faces OUTSIDE the vocabulary (Iowan Old Style,
   Charter, Baskerville, Cambria, Optima, Avenir, Futura, Gill Sans) DO clear it and are OS-installed, so they
   are self-contained (no download) - the practical way to make a real typeface choice under the no-webfont
   constraint. Verified all 8 example faces are absent from the vocab and all 6 avoid-list faces are present.

## Where the guidance belongs (surfaced, not cosmetic)

`SHARED_DESIGN_LAWS.typography.rules` (src/design-laws.ts) is a REAL surfaced guidance home: it reaches a
building model via flow-handler-font-research.ts (typeset flow), flow-handler-design-tokens.ts, and
flow-handler-brand-verify.ts. It currently has NO line about choosing a typeface / avoiding the system stack.
`SHARED_DESIGN_LAWS.spatial.rules` already carries a generic nested-cards line ("Cards are lazy answer: use
only when truly best affordance, never nested") that is clearly not landing (35-75% fire).

## Proposed edit (PRIMARY, validated) - append to design-laws.ts typography.rules

> Choose a typeface; never leave content on the bare system stack. Set body and headings to a font-family you
> deliberately picked (a loaded or self-hosted webfont). The bare `system-ui`/`-apple-system` stack and its
> monoculture members (Arial, Helvetica, Times, Georgia, Verdana, Segoe UI) are what you get when nobody chose,
> not a decision. When a webfont cannot be loaded, lead body and headings with a characterful OS-installed face
> (Iowan Old Style, Charter, Baskerville, Cambria for serif; Optima, Avenir, Futura, Gill Sans for sans) ahead
> of any generic fallback.

## Validation approach

Throwaway harness at scratchpad/typeface-ablation.mjs (measurement-only, NOT committed): copies the EXACT
neutral PROMPT_SYSTEM/PROMPT_RULES + generateClaude from provider-sample.mjs (self-checked byte-verbatim),
generates the first 6 held-out briefs WITHOUT vs WITH the injected line on claude-opus-4-8, and measures the
`default-typeface` fire-rate via Stage 1b measure() (eval/defect-distribution.mjs, shipping scanner). ~12 calls.

## RESULT

VALIDATED (measured by lead after the detached run landed). default-typeface WITH vs WITHOUT, claude-opus-4-8, 6 held-out briefs, Stage 1b shipping scanner:
- WITHOUT (neutral prompt): fired 6/6 = 100% (reproduces the finding baseline exactly).
- WITH (injected typeface-selection line): fired 0/6 = 0%.
- DELTA: -100pp. The line ELIMINATES default-typeface on the sample. 0 inconclusive both arms. Cost ~$3.37.
- HONEST SIBLING CAVEAT (n=6, likely partly noise): WITH the line, nested-cards 0->2/6 and low-contrast 4->5/6 ticked up; gray-on-color + tiny-text unchanged. A fuller run (more briefs, all 3 providers) is recommended before shipping the line, to confirm the -100pp holds and the sibling ticks are noise.
- The proposed default-typeface line (names characterful OS-installed faces - Iowan Old Style/Charter/Baskerville/Cambria serif; Optima/Avenir/Futura/Gill Sans sans - ahead of the generic fallback, under the no-webfont constraint) is a VALIDATED, evidence-backed improvement. The nested-cards line ("one level of card treatment only") is drafted but NOT yet validated. BOTH are PROPOSED for Jonah to approve - NOT applied to the shipped SKILL.md / design guidance.

## Files touched (this session)
- scratchpad/typeface-ablation.mjs (throwaway measurement harness, NOT in repo)
- .claude/memory/session_2026-07-25_act-on-stage1-findings.md (this beat)
- No shipped guidance edited (proposed only, per task).
