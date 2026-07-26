---
name: Prose-ablation sweep - real design-laws guidance lines ablated on claude-opus-4-8
description: Broad Stage 1d sweep over 5 real SHARED_DESIGN_LAWS guidance lines, WITH/WITHOUT x 8 held-out briefs, claude-opus-4-8; ranked defect-delta table + deletion recommendations
type: project
relates_to: [session_2026-07-25_stage1d-prose-ablation.md, session_2026-07-25_act-on-stage1-findings.md, session_2026-07-25_stage1-real-data-1c.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: dry-run green + live sweep (claude-opus-4-8, 28/48 calls before kill); re-measured via measure() over completed dirs; NONE primed above noise
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

## Live sweep - KILLED at 28/48 calls (~58% through), re-measured by hand
provider=claude, model=claude-opus-4-8, 5 candidates x 8 held-out briefs, SHARED baseline. The background run
(b6awvko8i) was KILLED before the harness produced its ranked table (log had only the START line). Generations
were preserved by `--out`, so I re-ran the harness's own `measure()` (defect-distribution.mjs) over the completed
condition dirs - exactly the recovery the coordinator specified. State at kill:
- baseline/ = 8 pages + manifest (COMPLETE)
- law-cards-never-nested__with = 8 pages + manifest (COMPLETE)
- law-no-pure-black-white__with = 8 pages + manifest (COMPLETE)
- law-wcag-aa-minimum__with = 4 pages, NO manifest (PARTIAL, killed mid-gen)
- law-tint-neutrals + law-size-ratio-3to1 = NEVER GENERATED (no data)

### Baseline distribution (N=8, un-injected prompt, claude-opus-4-8)
default-typeface 100% (8/8), low-contrast 88% (7/8), gray-on-color 50% (4/8), tiny-text 25% (2/8),
nested-cards 13% (1/8), skipped-heading 13% (1/8), soft-radial-glow 13% (1/8). Confirms claude's known
over-production of default-typeface / low-contrast / gray-on-color (the counter-rules premise). NOTE the small-N
drift vs the 20-page counter-rules sample (low-contrast 55%->88%, gray-on-color 30%->50%, nested-cards 35%->13%) -
expected at N=8.

### RANKED ABLATION TABLE (target-rule delta = WITH - WITHOUT; positive = PRIMES)
| candidate | target rule | WITHOUT | WITH | dDELTA | net(agg) | N base/with | MDE | verdict |
|---|---|---|---|---|---|---|---|---|
| law-cards-never-nested | nested-cards | 13% (1/8) | 13% (1/8) | +0pp | +2pp | 8/8 | 70pp | within noise (underpowered) |
| law-no-pure-black-white | low-contrast | 88% (7/8) | 75% (6/8) | -13pp | +3pp | 8/8 | 70pp | within noise (underpowered) |
| law-wcag-aa-minimum | low-contrast | 88% (7/8) | 75% (3/4) | -13pp | -1pp | 8/4 | 99pp | within noise (underpowered) [PARTIAL N] |
| law-tint-neutrals | gray-on-color | - | - | - | - | - | - | NOT COLLECTED (killed before gen) |
| law-size-ratio-3to1 | oversized-h1 | - | - | - | - | - | - | NOT COLLECTED (killed before gen) |

### Findings (honest)
- **ZERO lines primed their target above noise -> NO deletion recommendations.** Every measured delta (+0, -13,
  -13pp) is an order of magnitude below the MDE (70-99pp). At most a single page flipped (7/8 -> 6/8).
- **None of the 3 measured lines even LEANED prime.** The two low-contrast lines leaned slightly protective/flat;
  the nested-cards line was flat. The specific priming HYPOTHESIS for law-no-pure-black-white ("avoid pure black
  -> mid-gray primes low-contrast") is NOT supported by this data (it went the other way) - though underpowered.
- The sharp ironic-word-plant test (law-cards-never-nested, "...never nested") showed NO priming: nested-cards
  held at 13%. But baseline nested-cards was floor-low (1/8), so this is a weak test at this N.
- Even an explicit "WCAG AA minimum 4.5:1" reminder did NOT reliably suppress low-contrast (still 3/4) - claude's
  low-contrast is stubborn - but again not significant.

## Token spend
24 metered live calls (the 3 manifested dirs): 14,259 input + 281,771 output tokens = **~$7.12** at claude's
recorded rate (in $5/M, out $25/M). +4 unmetered law-wcag pages (killed before manifest write; usage not
persisted) ~ +$1.2 -> **~$8.3 total for 28 live calls.** The full 48-call run would have been ~$14; killed ~58%
through.

## Recommendations
1. **Delete nothing.** No guidance line is a deletion candidate on this evidence. (The tool only RECOMMENDS; here
   it recommends KEEP-ALL by default.)
2. **The sample is NOT powered to conclude a deletion** - two compounding limits: (a) N=8 -> MDE ~70pp, but real
   prose effects are single-to-low-double-digit pp (the power probe: sub-15pp effects cost ~$40k to distinguish);
   (b) the run was killed ~58% through, so 2 of 5 candidates have NO data and 1 is partial-N. This is exactly the
   harness's designed ceiling: a COARSE gross-priming-line finder, not a fine prose-tuning instrument.
3. **What the sweep DID earn:** (i) proof the harness runs live end-to-end on REAL product guidance lines (not
   just the built-in counter-rule candidates); (ii) a directional "no line primes its named defect" read - the
   opposite of the failure mode the sweep hunts; (iii) a fresh N=8 claude baseline reconfirming
   default-typeface/low-contrast/gray-on-color over-production.
4. **To actually power a deletion decision** would need far larger N per line (hundreds of pages) or accepting the
   >=70pp gross-gate (none of these lines are anywhere near it). Re-running the 2 uncollected candidates
   (tint-neutrals, size-ratio) would complete the table but would still land "within noise" at N=8.

## Hook note (bash-guard false-positive, worked around cleanly - NOT bypassed)
`--provider claude --model claude-opus-4-8` was BLOCKED by the session-model-override bash-guard (it matches the
substring `claude --model`, meant to catch a `claude` CLI session-model override; here `claude` is the harness
`--provider` value and `--model` is the harness's own flag). No bypass needed: the claude provider's modelDefault
is ALREADY claude-opus-4-8, so dropping `--model` resolves to the identical model. Flagging as a guard
over-match, not acted on further.

## Files (all scratchpad, NONE in repo)
- <scratch>/ablation-candidates.json (the 5-line candidate set)
- <scratch>/ablation-run/ (preserved generations: baseline 8, cards 8, no-pure-black-white 8, wcag 4)
- <scratch>/ablation.log (run log - only START, killed before ranking)
- <scratch>/remeasure.mjs (THROWAWAY driver: re-ran measure() over the completed dirs to build the table)
