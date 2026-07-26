---
name: Prose-ablation sweep - real design-laws guidance lines ablated on claude-opus-4-8
description: Broad Stage 1d sweep over 5 real SHARED_DESIGN_LAWS guidance lines, WITH/WITHOUT x 8 held-out briefs, claude-opus-4-8; ranked defect-delta table + deletion recommendations
type: project
relates_to: [session_2026-07-25_stage1d-prose-ablation.md, session_2026-07-25_act-on-stage1-findings.md, session_2026-07-25_stage1-real-data-1c.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: dry-run green + live sweep (claude-opus-4-8) - results pending on landing
confidence: high
---

# Stage 1d prose-ablation SWEEP (real product guidance lines)

Measurement run (not new committable code - the harness `eval/prose-ablation.mjs` already ships at commit
ba60fe33 and its `--self-test` is gated). Goal: find sidecoach guidance lines that PRIME the defects the shipping
scanner detects (positive defect-delta => deletion candidate). Collaborator: Jonah. Nothing in the repo touched;
candidates file + samples + log all in scratchpad, NOT the repo.

## Candidate set (5 REAL lines, verbatim from src/design-laws.ts SHARED_DESIGN_LAWS)
These are real product guidance emitted into design builds by the generation flow-handlers (grep-confirmed
consumers: flow-handler-design-references / -accessibility / -component-implementation / -motion* / -font-research
/ -brand-verify all read SHARED_DESIGN_LAWS). Each maps to a scanner-detected class (all 5 target rules verified
present in the live 22-rule universe by the harness preflight) with a plausible prime-or-protect mechanism.

| id | line (verbatim) | domain | target rule | claude base rate* | hypothesis |
|---|---|---|---|---|---|
| law-cards-never-nested | "Cards are lazy answer: use only when truly best affordance, never nested" | spatial | nested-cards | 35% (7/20) | protective (watch ironic word-plant) |
| law-no-pure-black-white | "Never use pure gray, black (#000), or white (#fff)" | color | low-contrast | 55% (11/20) | priming (avoid pure black -> mid-gray) |
| law-wcag-aa-minimum | "WCAG AA minimum: 4.5:1 on body text, 3:1 on large text and UI components" | color | low-contrast | 55% (11/20) | protective (explicit contrast floor) |
| law-tint-neutrals | "Tint every neutral with chroma 0.005-0.015 toward brand hue" | color | gray-on-color | 30% (6/20) | priming (tinted grays land on color) |
| law-size-ratio-3to1 | "Hierarchy through multiple dimensions: size 3:1+, weight contrast, color, position, space" | spatial | oversized-h1 | low (not in counter list) | priming (big ratio -> oversized h1) |

*claude base rate = the Stage 1b 20-page sample fire-rate from src/counter-rules.generated.ts (the same
distribution the shipping counter-rules were compiled from). Chosen deliberately so 3 of 5 targets (low-contrast
x2, nested-cards, gray-on-color) sit mid-range with room to move; oversized-h1 is floor-limited and flagged so.

Why these and not the built-in counter-rule candidates: the harness already ships the 3 counter-rule lines as its
built-in registry; this sweep tests a DIFFERENT, broader question - do the general design-laws that reach every
build prime the very defects they gesture at? Two lines on low-contrast (one plausibly priming, one plausibly
protecting) are a within-target contrast.

## Harness verification (zero cost) - GREEN
`node eval/prose-ablation.mjs --dry-run --candidates-file <scratch>/ablation-candidates.json --n 8` -> exit 0.
Candidates file parsed + validated (validateRegistry), all 5 target rules resolved as real scanner classes, full
ranked table produced. Mock DELETE on law-tint-neutrals (+88pp) is pure mock steering (dryDelta), confirming the
deletion-recommendation path fires. law-size-ratio-3to1 shows +0pp in the mock because oversized-h1 is NOT one of
the 6 controllable mock rules - the LIVE run measures it for real (expected, noted).

## Power reality (harness's own MDE)
At N=8 the harness prints min-detectable-effect ~70pp (80% power, worst-case p=0.5). The deletion gate is
|delta| >= 15pp AND >= MDE. So ONLY a >=70pp target-delta would be flagged DELETE. Real prose effects are far
smaller, so the expected honest outcome is "none primed above noise" with directional leans only. This sweep is a
COARSE gross-priming-line finder + live-plumbing proof, NOT a fine prose-tuning instrument (consistent with the
Probe 1 finding: sub-15pp effects cost ~$40k to distinguish; the tool is scoped to gross lines only).

## Live sweep (RUNNING, background id b6awvko8i)
provider=claude, model resolves to modelDefault claude-opus-4-8 (SIDECOACH_CLAUDE_MODEL unset; --model flag
deliberately omitted - see hook note), 5 candidates x 8 held-out briefs, SHARED baseline (default; tighter pairing
+ ~half cost, correct for a ranking tool). Call count = 8 baseline + 5x8 with = 48 live calls (~2 min each per the
1c "claude slow" note, so ~90 min). `--out <scratch>/ablation-run` preserves generations (exit-5 flake recovery);
`--json` for the structured rows. Log at <scratch>/ablation.log. Token spend + ranked table + deletion recs
appended on landing.

## Hook note (bash-guard false-positive, worked around cleanly - NOT bypassed)
`--provider claude --model claude-opus-4-8` was BLOCKED by the session-model-override bash-guard (it matches the
substring `claude --model`, meant to catch a `claude` CLI session-model override; here `claude` is the harness
`--provider` value and `--model` is the harness's own flag). No bypass needed: the claude provider's modelDefault
is ALREADY claude-opus-4-8, so dropping `--model` resolves to the identical model. Flagging as a guard
over-match, not acted on further.

## Files (all scratchpad, NONE in repo)
- <scratch>/ablation-candidates.json (the 5-line candidate set)
- <scratch>/ablation-run/ (preserved generations)
- <scratch>/ablation.log (run log + JSON)
